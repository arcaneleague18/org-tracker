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
          server.middlewares.use(async (req: any, res: any, next: any) => {
            if (req.url && req.url.startsWith('/api/github')) {
              const urlObj = new URL(req.url, 'http://localhost:3000');
              const ghPath = urlObj.searchParams.get('path');
              if (!ghPath || !ghPath.startsWith('/') || ghPath.includes('://')) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: 'Invalid or missing "path" parameter' }));
              }

              const clientToken = (req.headers['x-github-token'] as string | undefined)?.trim();
              const token = clientToken || env.GITHUB_TOKEN || env.GH_TOKEN || env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

              if (!token) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ message: 'No GitHub token configured on server or in request.' }));
              }

              try {
                const targetUrl = `https://api.github.com${ghPath}`;
                const ghRes = await fetch(targetUrl, {
                  headers: {
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    Authorization: `Bearer ${token}`
                  }
                });

                const rateHeaders = ['x-ratelimit-remaining', 'x-ratelimit-limit', 'x-ratelimit-reset'];
                for (const h of rateHeaders) {
                  const val = ghRes.headers.get(h);
                  if (val) res.setHeader(h, val);
                }

                res.statusCode = ghRes.status;
                const contentType = ghRes.headers.get('content-type') || 'application/json';
                res.setHeader('Content-Type', contentType);
                const body = await ghRes.arrayBuffer();
                return res.end(Buffer.from(body));
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
