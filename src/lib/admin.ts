export type AdminAuthState = 'ok' | 'unconfigured' | 'unauthorized';

export const ADMIN_REALM = 'Real Estate Broker Admin';

export function checkAdmin(request: Request, password: string | undefined): AdminAuthState {
  if (!password) return 'unconfigured';
  const header = request.headers.get('authorization') ?? '';
  const expected = `Basic ${btoa(`admin:${password}`)}`;
  return header === expected ? 'ok' : 'unauthorized';
}

function jsonError(status: number, code: string, message: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function adminUnconfiguredResponse(): Response {
  return jsonError(503, 'ADMIN_UNCONFIGURED', 'ADMIN_PASSWORD no está configurado.', {
    'cache-control': 'no-store',
  });
}

export function adminUnauthorizedResponse(): Response {
  return jsonError(401, 'UNAUTHORIZED', 'Credenciales inválidas.', {
    'WWW-Authenticate': `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
    'cache-control': 'no-store',
  });
}
