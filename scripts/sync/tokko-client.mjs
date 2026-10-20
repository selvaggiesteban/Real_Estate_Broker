const API_BASE = 'https://www.tokkobroker.com/api/v1';
const DEFAULT_LIMIT = 100;
const PAUSE_MS = 250;
const TIMEOUT_MS = 15000;
const RETRIES = 3;

export class TokkoError extends Error {
  constructor(message, { status, url, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'TokkoError';
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(resource, apiKey, limit, offset) {
  const params = new URLSearchParams({ key: apiKey, limit: String(limit), offset: String(offset) });
  return `${API_BASE}/${resource}/?${params.toString()}`;
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json', 'user-agent': 'real-estate-broker-sync/1.0' },
      });

      if (response.ok) return await response.json();

      const error = new TokkoError(`Tokko respondió HTTP ${response.status}.`, {
        status: response.status,
        url,
      });
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof TokkoError && (error.status === 401 || error.status === 403)) {
        throw new TokkoError(
          `API key de Tokko rechazada (HTTP ${error.status}) — revisá el secret TOKKO_API_KEY.`,
          { status: error.status, url, cause: error },
        );
      }
      if (error instanceof TokkoError && error.status) throw error;
      lastError =
        error instanceof TokkoError
          ? error
          : new TokkoError(`Fallo de red consultando Tokko: ${error.message}`, { url, cause: error });
    } finally {
      clearTimeout(timer);
    }
    if (attempt < RETRIES) await sleep(500 * 2 ** (attempt - 1));
  }
  throw lastError ?? new TokkoError('Fallo desconocido consultando Tokko.', { url });
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.objects)) return payload.objects;
  return [];
}

function extractTotal(payload) {
  const total = payload?.meta?.total_count ?? payload?.meta?.total;
  return typeof total === 'number' ? total : undefined;
}

export async function fetchAllProperties(
  apiKey,
  { limit = DEFAULT_LIMIT, pauseMs = PAUSE_MS, maxPages = Infinity, onProgress } = {},
) {
  const items = [];
  const seen = new Set();
  let offset = 0;
  let page = 0;
  let total;

  for (;;) {
    page += 1;
    const payload = await fetchJson(buildUrl('property', apiKey, limit, offset));
    const batch = extractItems(payload);
    if (page === 1) total = extractTotal(payload);

    for (const item of batch) {
      const key = item?.id ?? JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }

    onProgress?.({ page, fetched: items.length, total });
    if (batch.length === 0 || batch.length < limit) break;
    if (total !== undefined && items.length >= total) break;
    if (page >= maxPages) break;

    offset += batch.length;
    await sleep(pauseMs);
  }

  return { items, total };
}

export async function fetchInactiveCount(apiKey) {
  try {
    const payload = await fetchJson(buildUrl('inactiveproperty', apiKey, 1, 0));
    return extractTotal(payload) ?? extractItems(payload).length;
  } catch {
    return undefined; // métrica de reporte: nunca debe romper el sync
  }
}
