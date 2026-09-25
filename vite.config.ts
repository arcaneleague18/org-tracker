import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

declare const Buffer: {
  from: (data: ArrayBuffer | Uint8Array) => any;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'local-api-proxy',
        configureServer(server) {
          interface RateLimitBucket {
            count: number;
            resetTime: number;
          }
          interface CachedResponse {
            status: number;
            body: Buffer;
            contentType: string;
            rateLimitHeaders: Record<string, string>;
            expiresAt: number;
          }

          const ipRateLimitMap = new Map<string, RateLimitBucket>();
          const responseCacheMap = new Map<string, CachedResponse>();

          const RATE_LIMIT_WINDOW_MS = 60 * 1000;
          const MAX_REQUESTS_PER_WINDOW = 120;
          const CACHE_TTL_MS = 60 * 1000;

          const getClientIp = (req: any): string => {
            const forwarded = req.headers['x-forwarded-for'];
            if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
            return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
          };

          const checkRateLimit = (ip: string): { allowed: boolean; remaining: number; resetSeconds: number } => {
            const now = Date.now();
            let bucket = ipRateLimitMap.get(ip);
            if (!bucket || now >= bucket.resetTime) {
              bucket = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
              ipRateLimitMap.set(ip, bucket);
              return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
            }
            if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
              return { allowed: false, remaining: 0, resetSeconds: Math.max(1, Math.ceil((bucket.resetTime - now) / 1000)) };
            }
            bucket.count++;
            return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - bucket.count, resetSeconds: Math.max(1, Math.ceil((bucket.resetTime - now) / 1000)) };
          };

          const isAllowedGitHubApiPath = (pathname: string, targetOrg?: string): boolean => {
            const normalized = pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
            if (normalized === '/user') return true;

            const orgMatch = normalized.match(/^\/orgs\/([^/]+)(?:\/(members|repos))?$/);
            if (orgMatch) {
              const [, org] = orgMatch;
              if (targetOrg && org.toLowerCase() !== targetOrg.toLowerCase()) return false;
              return true;
            }

            const repoMatch = normalized.match(/^\/repos\/([^/]+)\/([^/]+)\/(commits|pulls|issues)(?:\/(\d+)\/reviews)?$/);
            if (repoMatch) {
              const [, org, , endpoint, reviewPrNumber] = repoMatch;
              if (targetOrg && org.toLowerCase() !== targetOrg.toLowerCase()) return false;
              if (reviewPrNumber && endpoint !== 'pulls') return false;
              return true;
            }

            return false;
          };

          server.middlewares.use(async (req: any, res: any, next: any) => {
            if (req.url && req.url.startsWith('/api/github')) {
              // 1. IP Rate Limiting
              const clientIp = getClientIp(req);
              const rateLimit = checkRateLimit(clientIp);

              res.setHeader('X-Proxy-RateLimit-Limit', String(MAX_REQUESTS_PER_WINDOW));
              res.setHeader('X-Proxy-RateLimit-Remaining', String(rateLimit.remaining));
              res.setHeader('X-Proxy-RateLimit-Reset', String(rateLimit.resetSeconds));

              if (!rateLimit.allowed) {
                res.statusCode = 429;
                res.setHeader('Retry-After', String(rateLimit.resetSeconds));
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({
                  message: 'Too Many Requests: Proxy rate limit exceeded. Please wait before retrying.',
                  retryAfter: rateLimit.resetSeconds
                }));
              }

              // 2. Validate URL and path
              const urlObj = new URL(req.url, 'http://localhost:3000');
              const ghPath = urlObj.searchParams.get('path');
              if (!ghPath || !ghPath.startsWith('/') || ghPath.startsWith('//') || ghPath.includes('://')) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: 'Invalid or missing "path" parameter' }));
              }

              let parsedUrl: URL;
              try {
                parsedUrl = new URL(ghPath, 'https://api.github.com');
              } catch {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: 'Malformed path parameter' }));
              }

              if (parsedUrl.origin !== 'https://api.github.com') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: 'Invalid origin in path parameter' }));
              }

              const clientToken = (req.headers['x-github-token'] as string | undefined)?.trim();
              const token = clientToken || env.GITHUB_TOKEN || env.GH_TOKEN || env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

              if (!token) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: 'No GitHub token configured on server or in request.' }));
              }

              const configuredOrg = (env.VITE_GITHUB_ORG || 'Move2Move').trim();
              const targetOrgForCheck = clientToken ? undefined : configuredOrg;

              if (!isAllowedGitHubApiPath(parsedUrl.pathname, targetOrgForCheck)) {
                res.statusCode = 403;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({
                  message: 'Access to this GitHub API endpoint is restricted by security policy. Only authorized telemetry routes are permitted.'
                }));
              }

              // 3. In-Memory Response Caching
              const isServerToken = !clientToken;
              const cacheKey = isServerToken
                ? `server:${parsedUrl.toString()}`
                : `custom:${token.substring(0, 10)}:${parsedUrl.toString()}`;

              const cached = responseCacheMap.get(cacheKey);
              if (cached && Date.now() < cached.expiresAt) {
                res.setHeader('X-Proxy-Cache', 'HIT');
                for (const [h, val] of Object.entries(cached.rateLimitHeaders)) {
                  res.setHeader(h, val);
                }
                res.statusCode = cached.status;
                res.setHeader('Content-Type', cached.contentType);
                return res.end(cached.body);
              }

              try {
                const targetUrl = parsedUrl.toString();
                const ghRes = await fetch(targetUrl, {
                  headers: {
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    Authorization: `Bearer ${token}`
                  }
                });

                res.setHeader('X-Proxy-Cache', 'MISS');

                const rateHeaders: Record<string, string> = {};
                const rateHeaderNames = ['x-ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-reset'];
                for (const h of rateHeaderNames) {
                  const val = ghRes.headers.get(h);
                  if (val) {
                    res.setHeader(h, val);
                    rateHeaders[h] = val;
                  }
                }

                res.statusCode = ghRes.status;
                const contentType = ghRes.headers.get('content-type') || 'application/json';
                res.setHeader('Content-Type', contentType);
                const arrayBuf = await ghRes.arrayBuffer();
                const bodyBuffer = Buffer.from(arrayBuf);

                if (ghRes.ok) {
                  if (responseCacheMap.size >= 200) {
                    const oldest = responseCacheMap.keys().next().value;
                    if (oldest) responseCacheMap.delete(oldest);
                  }
                  responseCacheMap.set(cacheKey, {
                    status: ghRes.status,
                    body: bodyBuffer,
                    contentType,
                    rateLimitHeaders: rateHeaders,
                    expiresAt: Date.now() + CACHE_TTL_MS
                  });
                }

                return res.end(bodyBuffer);
              } catch (err: any) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: err?.message || 'Proxy Error' }));
              }
            }
            next();
          });
        }
      }
    ],
    server: {
      port: 3000,
      open: true
    }
  };
});
