// Vercel Serverless Function: Secure GitHub API Proxy
// Keeps GITHUB_TOKEN strictly on the server and completely hidden from client bundles.

declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * Strict endpoint allowlist for Move2Move telemetry queries.
 * Validates that the requested GitHub API pathname matches only allowed telemetry routes.
 */
function isAllowedGitHubApiPath(pathname: string, targetOrg?: string): boolean {
  // Normalize: collapse multiple slashes and trim trailing slash
  const normalized = pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

  // 1. Authenticated user profile check (exact /user only, no subpaths)
  if (normalized === '/user') {
    return true;
  }

  // 2. Organization endpoints: /orgs/:org, /orgs/:org/members, /orgs/:org/repos
  const orgMatch = normalized.match(/^\/orgs\/([^/]+)(?:\/(members|repos))?$/);
  if (orgMatch) {
    const [, org] = orgMatch;
    if (targetOrg && org.toLowerCase() !== targetOrg.toLowerCase()) {
      return false;
    }
    return true;
  }

  // 3. Repository telemetry endpoints:
  //    /repos/:org/:repo/commits
  //    /repos/:org/:repo/pulls
  //    /repos/:org/:repo/pulls/:number/reviews
  //    /repos/:org/:repo/issues
  const repoMatch = normalized.match(/^\/repos\/([^/]+)\/([^/]+)\/(commits|pulls|issues)(?:\/(\d+)\/reviews)?$/);
  if (repoMatch) {
    const [, org, , endpoint, reviewPrNumber] = repoMatch;
    if (targetOrg && org.toLowerCase() !== targetOrg.toLowerCase()) {
      return false;
    }
    // If reviewPrNumber is present, endpoint must be 'pulls'
    if (reviewPrNumber && endpoint !== 'pulls') {
      return false;
    }
    return true;
  }

  return false;
}

interface RateLimitBucket {
  count: number;
  resetTime: number; // epoch ms
}

interface CachedResponse {
  status: number;
  data: any;
  contentType: string;
  rateLimitHeaders: Record<string, string>;
  expiresAt: number; // epoch ms
}

// In-memory state maintained across requests in the serverless container instance
const ipRateLimitMap = new Map<string, RateLimitBucket>();
const responseCacheMap = new Map<string, CachedResponse>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 120; // 120 requests/minute per client IP
const CACHE_TTL_MS = 60 * 1000; // 60 seconds response cache
const MAX_CACHE_ENTRIES = 200; // Cap cache map memory footprint
const MAX_RATE_LIMIT_ENTRIES = 5000; // Cap rate limit map memory footprint

function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  let bucket = ipRateLimitMap.get(ip);

  // Evict expired entries when capacity is approached
  if (ipRateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    for (const [k, v] of ipRateLimitMap.entries()) {
      if (now >= v.resetTime) {
        ipRateLimitMap.delete(k);
      }
    }
  }

  if (!bucket || now >= bucket.resetTime) {
    bucket = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
    ipRateLimitMap.set(ip, bucket);
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.max(1, Math.ceil((bucket.resetTime - now) / 1000))
    };
  }

  bucket.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - bucket.count,
    resetSeconds: Math.max(1, Math.ceil((bucket.resetTime - now) / 1000))
  };
}

function getCachedResponse(cacheKey: string): CachedResponse | null {
  const cached = responseCacheMap.get(cacheKey);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    responseCacheMap.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedResponse(cacheKey: string, resp: Omit<CachedResponse, 'expiresAt'>): void {
  if (responseCacheMap.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCacheMap.keys().next().value;
    if (oldestKey) responseCacheMap.delete(oldestKey);
  }
  responseCacheMap.set(cacheKey, {
    ...resp,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

export default async function handler(req: any, res: any) {
  // 1. Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Client IP Rate Limiting (120 req/min per IP)
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  res.setHeader('X-Proxy-RateLimit-Limit', String(MAX_REQUESTS_PER_WINDOW));
  res.setHeader('X-Proxy-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-Proxy-RateLimit-Reset', String(rateLimit.resetSeconds));

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.resetSeconds));
    return res.status(429).json({
      message: 'Too Many Requests: Proxy rate limit exceeded. Please wait before retrying.',
      retryAfter: rateLimit.resetSeconds
    });
  }

  // 3. Extract and validate path parameter
  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ message: 'Missing required "path" query parameter' });
  }

  // 4. SSRF & Scheme Protection: Ensure path begins with single "/" and contains no protocol scheme
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return res.status(400).json({ message: 'Invalid path format: must be an absolute GitHub API path starting with "/"' });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(path, 'https://api.github.com');
  } catch {
    return res.status(400).json({ message: 'Malformed path parameter' });
  }

  if (parsedUrl.origin !== 'https://api.github.com') {
    return res.status(400).json({ message: 'Invalid origin in path parameter' });
  }

  // 5. Token priority: client override header > server environment variable
  const clientOverrideToken = (req.headers['x-github-token'] as string | undefined)?.trim();
  const serverToken = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.VITE_GITHUB_TOKEN || '')?.trim();
  const token = clientOverrideToken || serverToken;

  if (!token) {
    return res.status(401).json({
      message: 'No GitHub Personal Access Token configured on the server. Please set GITHUB_TOKEN in Vercel project environment variables.'
    });
  }

  // 6. Endpoint Allowlist and Organization Scoping
  // When using serverToken, restrict :org strictly to configured organization
  const configuredOrg = (process.env.VITE_GITHUB_ORG || 'Move2Move').trim();
  const targetOrgForCheck = clientOverrideToken ? undefined : configuredOrg;

  if (!isAllowedGitHubApiPath(parsedUrl.pathname, targetOrgForCheck)) {
    return res.status(403).json({
      message: 'Access to this GitHub API endpoint is restricted by security policy. Only authorized telemetry routes are permitted.'
    });
  }

  // 7. In-Memory Response Cache Check (prevents upstream GitHub rate limit drainage)
  const isServerToken = !clientOverrideToken;
  const cacheKey = isServerToken
    ? `server:${parsedUrl.toString()}`
    : `custom:${token.substring(0, 10)}:${parsedUrl.toString()}`;

  const cached = getCachedResponse(cacheKey);
  if (cached) {
    res.setHeader('X-Proxy-Cache', 'HIT');
    for (const [h, val] of Object.entries(cached.rateLimitHeaders)) {
      res.setHeader(h, val);
    }
    if (cached.contentType.includes('application/json')) {
      return res.status(cached.status).json(cached.data);
    } else {
      return res.status(cached.status).send(cached.data);
    }
  }

  // 8. Dispatch Upstream Request to GitHub REST API
  try {
    const targetUrl = parsedUrl.toString();
    const ghResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`
      }
    });

    res.setHeader('X-Proxy-Cache', 'MISS');

    // Forward GitHub Rate Limit headers to client
    const rateLimitHeaders: Record<string, string> = {};
    const rateLimitHeaderNames = ['x-ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-reset'];
    for (const h of rateLimitHeaderNames) {
      const val = ghResponse.headers.get(h);
      if (val) {
        res.setHeader(h, val);
        rateLimitHeaders[h] = val;
      }
    }

    const contentType = ghResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await ghResponse.json();
      if (ghResponse.ok) {
        setCachedResponse(cacheKey, {
          status: ghResponse.status,
          data,
          contentType,
          rateLimitHeaders
        });
      }
      return res.status(ghResponse.status).json(data);
    } else {
      const text = await ghResponse.text();
      if (ghResponse.ok) {
        setCachedResponse(cacheKey, {
          status: ghResponse.status,
          data: text,
          contentType,
          rateLimitHeaders
        });
      }
      return res.status(ghResponse.status).send(text);
    }
  } catch (error: any) {
    return res.status(502).json({
      message: error?.message || 'Failed to reach GitHub REST API'
    });
  }
}
