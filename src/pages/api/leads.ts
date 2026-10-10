import type { APIRoute } from 'astro';

interface LeadPayload {
  nombre?: unknown;
  email?: unknown;
  telefono?: unknown;
  mensaje?: unknown;
  propiedad?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST: APIRoute = async ({ request }) => {
  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'INVALID_JSON', message: 'El cuerpo debe ser JSON válido.' },
      }),
      { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  const nombre = typeof payload.nombre === 'string' ? payload.nombre.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const telefono = typeof payload.telefono === 'string' ? payload.telefono.trim() : '';
  const mensaje = typeof payload.mensaje === 'string' ? payload.mensaje.trim() : '';
  const propiedad = typeof payload.propiedad === 'string' ? payload.propiedad.trim() : '';

  const errors: string[] = [];
  if (nombre.length < 2) errors.push('nombre debe tener al menos 2 caracteres.');
  if (!EMAIL_RE.test(email)) errors.push('email inválido.');
  if (mensaje.length < 10) errors.push('mensaje debe tener al menos 10 caracteres.');

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.', details: errors },
      }),
      { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  console.log('[lead]', JSON.stringify({ nombre, email, telefono, propiedad, len: mensaje.length }));

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        estado: 'recibido',
        mensaje: 'Recibimos tu consulta. Una inmobiliaria te contactará a la brevedad.',
      },
    }),
    { status: 202, headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
};
