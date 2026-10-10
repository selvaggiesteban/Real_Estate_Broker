import type { APIRoute } from 'astro';

const startedAt = Date.now();

export const GET: APIRoute = () => {
  const body = {
    ok: true,
    data: {
      service: 'real-estate-broker',
      status: 'ok',
      version: '0.1.0',
      runtime: 'cloudflare-pages',
      uptimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
};
