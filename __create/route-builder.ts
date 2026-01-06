import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

/**
 * IMPORTANT:
 * - ビルド後(SSR bundle)では、このファイルの実体が build/server/... に置かれることがある
 * - import.meta.url 基準で ../src/app/api を組むと、build/server/src/app/api を見に行って ENOENT になりがち
 * なので「プロジェクトルート(process.cwd())」基準で src/app/api を参照する
 */
const API_DIR = resolve(process.cwd(), 'src', 'app', 'api');

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Recursively find all route.js files
async function findRouteFiles(dir: string): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    // API_DIR が存在しない/読めない環境でもビルドを落としにくくする
    console.error('Error finding route files:', error);
    return [];
  }

  let routes: string[] = [];

  for (const file of files) {
    try {
      const filePath = join(dir, file);
      const statResult = await stat(filePath);

      if (statResult.isDirectory()) {
        routes = routes.concat(await findRouteFiles(filePath));
      } else if (file === 'route.js') {
        // Handle root route.js specially
        if (filePath === join(API_DIR, 'route.js')) {
          routes.unshift(filePath); // Add to beginning of array
        } else {
          routes.push(filePath);
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }

  return routes;
}

// Helper function to transform file path to Hono route path
function getHonoPath(routeFile: string): { name: string; pattern: string }[] {
  // API_DIR を基準に相対化する
  let relativePath = routeFile.replace(API_DIR, '');

  // Windows対策（RenderはLinuxだけど念のため）
  relativePath = relativePath.replaceAll('\\', '/');

  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1); // Remove 'route.js'

  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }

  const transformedParts = routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });

  return transformedParts;
}

// Import and register all routes
async function registerRoutes() {
  const routeFiles = (await findRouteFiles(API_DIR))
    .slice()
    .sort((a, b) => b.length - a.length);

  // Clear existing routes
  api.routes = [];

  for (const routeFile of routeFiles) {
    try {
      const route = await import(/* @vite-ignore */ `${routeFile}?update=${Date.now()}`);

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

      for (const method of methods) {
        try {
          if (route[method]) {
            const parts = getHonoPath(routeFile);
            const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;

            const handler: Handler = async (c) => {
              const params = c.req.param();

              if (import.meta.env.DEV) {
                const updatedRoute = await import(
                  /* @vite-ignore */ `${routeFile}?update=${Date.now()}`
                );
                return await updatedRoute[method](c.req.raw, { params });
              }

              return await route[method](c.req.raw, { params });
            };

            switch (method.toLowerCase()) {
              case 'get':
                api.get(honoPath, handler);
                break;
              case 'post':
                api.post(honoPath, handler);
                break;
              case 'put':
                api.put(honoPath, handler);
                break;
              case 'delete':
                api.delete(honoPath, handler);
                break;
              case 'patch':
                api.patch(honoPath, handler);
                break;
              default:
                console.warn(`Unsupported method: ${method}`);
                break;
            }
          }
        } catch (error) {
          console.error(`Error registering route ${routeFile} for method ${method}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error importing route file ${routeFile}:`, error);
    }
  }
}

// Initial route registration
await registerRoutes();

// Hot reload routes in development
if (import.meta.env.DEV) {
  import.meta.glob('../src/app/api/**/route.js', {
    eager: true,
  });

  if (import.meta.hot) {
    import.meta.hot.accept((newSelf) => {
      registerRoutes().catch((err) => {
        console.error('Error reloading routes:', err);
      });
    });
  }
}

export { api, API_BASENAME };

