import type { APIRoute } from 'astro';
import { adminUnconfiguredResponse, adminUnauthorizedResponse, checkAdmin } from '../../lib/admin';
import type { ApiEnvelope, ApiError, Lead } from '../../lib/types';

interface LeadPayload {
  nombre?: unknown;
  email?: unknown;
  telefono?: unknown;
  mensaje?: unknown;
  propiedad?: unknown;
  source?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAGE_SIZE_DEFAULT = 100;
const PAGE_SIZE_MAX = 500;
const CSV_LIMIT = 1000;

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function errorResponse(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  const body: ApiError = { ok: false, error: { code, message } };
  return jsonResponse(body, status, headers);
}

function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, max);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  const password = locals.runtime.env.ADMIN_PASSWORD;
  const auth = checkAdmin(request, password);
  if (auth === 'unconfigured') return adminUnconfiguredResponse();
  if (auth === 'unauthorized') return adminUnauthorizedResponse();

  const db = locals.runtime.env.DB;
  const noStore = { 'cache-control': 'no-store' };

  try {
    if (url.searchParams.get('format') === 'csv') {
      const { results } = await db
        .prepare(
          'SELECT id, nombre, email, telefono, propiedad, mensaje, source, created_at FROM leads ORDER BY created_at DESC, id DESC LIMIT ?',
        )
        .bind(CSV_LIMIT)
        .all<Lead>();

      const header = 'id,created_at,nombre,email,telefono,propiedad,source,mensaje';
      const rows = results.map((lead) =>
        [
          String(lead.id),
          lead.created_at,
          lead.nombre,
          lead.email,
          lead.telefono,
          lead.propiedad,
          lead.source,
          lead.mensaje,
        ]
          .map(csvEscape)
          .join(','),
      );
      const csv = [header, ...rows].join('\r\n');
      const date = new Date().toISOString().slice(0, 10);

      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="leads-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    const page = parsePositiveInt(url.searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(url.searchParams.get('limit'), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
    const offset = (page - 1) * limit;

    const countResult = await db.prepare('SELECT COUNT(*) AS total FROM leads').all<{ total: number }>();
    const total = countResult.results[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const { results } = await db
      .prepare(
        'SELECT id, nombre, email, telefono, propiedad, mensaje, source, created_at FROM leads ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
      )
      .bind(limit, offset)
      .all<Lead>();

    const linksFor = (target: number) => `${url.origin}/api/leads?page=${target}&limit=${limit}`;

    const body: ApiEnvelope<Lead[]> = {
      ok: true,
      data: results,
      meta: { total, page, limit, totalPages },
      links: {
        self: linksFor(page),
        first: linksFor(1),
        ...(page < totalPages ? { next: linksFor(page + 1) } : {}),
        ...(page > 1 ? { prev: linksFor(page - 1) } : {}),
      },
    };

    return jsonResponse(body, 200, noStore);
  } catch (error) {
    console.error('[leads:get]', error);
    return errorResponse(500, 'LEADS_UNAVAILABLE', 'No se pudo consultar la base de leads.', noStore);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido.');
  }

  const nombre = typeof payload.nombre === 'string' ? payload.nombre.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const telefono = typeof payload.telefono === 'string' ? payload.telefono.trim() : '';
  const mensaje = typeof payload.mensaje === 'string' ? payload.mensaje.trim() : '';
  const propiedad = typeof payload.propiedad === 'string' ? payload.propiedad.trim() : '';
  const source = typeof payload.source === 'string' ? payload.source.trim() : '';

  const errors: string[] = [];
  if (nombre.length < 2) errors.push('nombre debe tener al menos 2 caracteres.');
  if (!EMAIL_RE.test(email)) errors.push('email inválido.');
  if (mensaje.length < 10) errors.push('mensaje debe tener al menos 10 caracteres.');

  if (errors.length > 0) {
    const body: ApiError & { error: { details: string[] } } = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.', details: errors },
    };
    return jsonResponse(body, 400);
  }

  try {
    await locals.runtime.env.DB.prepare(
      'INSERT INTO leads (nombre, email, telefono, propiedad, mensaje, source) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(nombre, email, telefono, propiedad, mensaje, source)
      .run();
  } catch (error) {
    console.error('[lead] insert failed', error);
    return errorResponse(500, 'LEAD_STORE_FAILED', 'No pudimos registrar tu consulta. Intentá nuevamente.');
  }

  console.log('[lead]', JSON.stringify({ nombre, email, telefono, propiedad, len: mensaje.length }));

  return jsonResponse(
    {
      ok: true,
      data: {
        estado: 'recibido',
        mensaje: 'Recibimos tu consulta. Una inmobiliaria te contactará a la brevedad.',
      },
    },
    202,
  );
};
