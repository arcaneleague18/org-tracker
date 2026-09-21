// Vercel Serverless Function: Secure GitHub API Proxy
// Keeps GITHUB_TOKEN strictly on the server and completely hidden from client bundles.

declare const process: {
  env: Record<string, string | undefined>;
};

export default async function handler(req: any, res: any) {
  // 1. Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Extract and validate path parameter
  const { path } = req.query;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ message: 'Missing required "path" query parameter' });
  }

  // 3. SSRF Protection: Ensure path begins with "/" and contains no protocol scheme
  if (!path.startsWith('/') || path.includes('://')) {
    return res.status(400).json({ message: 'Invalid path format: must be an absolute GitHub API path starting with "/"' });
  }

  // 4. Token priority: client override header > server environment variable
  const clientOverrideToken = (req.headers['x-github-token'] as string | undefined)?.trim();
  const serverToken = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.VITE_GITHUB_TOKEN || '')?.trim();
  const token = clientOverrideToken || serverToken;

  if (!token) {
    return res.status(401).json({
      message: 'No GitHub Personal Access Token configured on the server. Please set GITHUB_TOKEN in Vercel project environment variables.'
    });
  }

  try {
    const targetUrl = `https://api.github.com${path}`;
    const ghResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`
      }
    });

    // Forward GitHub Rate Limit headers to client
    const rateLimitHeaders = ['x-ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-reset'];
    for (const h of rateLimitHeaders) {
      const val = ghResponse.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    }

    const contentType = ghResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await ghResponse.json();
      return res.status(ghResponse.status).json(data);
    } else {
      const text = await ghResponse.text();
      return res.status(ghResponse.status).send(text);
    }
  } catch (error: any) {
    return res.status(502).json({
      message: error?.message || 'Failed to reach GitHub REST API'
    });
  }
}
