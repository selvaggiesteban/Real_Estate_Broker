const FALLBACK_IMAGEN = '/images/properties/depto-exterior.svg';
const MAX_IMAGENES = 12;
const MAX_CARACTERISTICAS = 25;

export const AGENCY_DEFAULT = {
  nombre: 'Nueva Espacio Propiedades',
  telefono: '+54 11 4832-1000',
  email: 'contacto@nuevaespacio.example.com',
};

const TIPOS_POR_PALABRA = [
  ['ph', [/\bph\b/]],
  ['departamento', ['departamento', 'depto', 'depa', 'apartamento', 'flat']],
  ['casa', ['casa', 'quinta', 'villa', 'chalet', 'house']],
  ['terreno', ['terreno', 'lote', 'solar', 'land']],
  ['oficina', ['oficina', 'office']],
  ['local', ['local', 'comercial', 'galpon']],
];

function getPath(source, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
}

function textOf(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const unwrapped = value.name ?? value.title ?? value.label;
    return typeof unwrapped === 'string' ? unwrapped.trim() || undefined : undefined;
  }
  return undefined;
}

function pickText(source, paths) {
  for (const path of paths) {
    const text = textOf(getPath(source, path));
    if (text) return text;
  }
  return undefined;
}

function firstDefined(source, paths) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function asNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  let text = value.trim().replace(/[^\d.,-]/g, '');
  if (!text) return undefined;
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickNumber(source, paths) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (value !== undefined && value !== null && typeof value === 'object') {
      const nested = asNumber(value.amount ?? value.value ?? value.price);
      if (nested !== undefined && nested > 0) return nested;
      continue;
    }
    const parsed = asNumber(value);
    if (parsed !== undefined && parsed > 0) return parsed;
  }
  return undefined;
}

// Coordenadas: signo libre (hemisferio sur es negativo), a diferencia de pickNumber.
function pickSigned(source, paths) {
  for (const path of paths) {
    const parsed = asNumber(getPath(source, path));
    if (parsed !== undefined && Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

function stripHtml(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function mapOperacion(raw) {
  const text = pickText(raw, ['operation.name', 'operation', 'tipo_operacion', 'operation_name']);
  const norm = (text ?? '').toLowerCase();
  if (norm.includes('alquiler') || norm === 'rent' || norm === 'rental') return 'alquiler';
  if (norm.includes('venta') || norm === 'sale' || norm === 'sell') return 'venta';
  return null;
}

function mapTipo(raw, addIssue, id) {
  const text = pickText(raw, ['property_type.name', 'property_type', 'type.name', 'type', 'tipo']);
  const norm = (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!norm) {
    addIssue('tipo-fallback', `${id}: tipo vacío → departamento`);
    return 'departamento';
  }
  for (const [tipo, palabras] of TIPOS_POR_PALABRA) {
    const match = palabras.some((palabra) =>
      palabra instanceof RegExp ? palabra.test(norm) : norm.includes(palabra),
    );
    if (match) return tipo;
  }
  addIssue('tipo-fallback', `${id}: tipo no reconocido "${text}" → departamento`);
  return 'departamento';
}

function mapMoneda(raw, operacion, precio, addIssue, id) {
  const text = pickText(raw, ['currency.name', 'currency', 'moneda', 'price_currency']);
  const norm = (text ?? '').toLowerCase();
  if (norm.includes('usd') || norm.includes('dolar') || norm.includes('dólar')) return 'USD';
  if (norm.includes('ars') || norm.includes('peso')) return 'ARS';
  const inferida = operacion === 'alquiler' && precio >= 5000 ? 'ARS' : 'USD';
  addIssue('moneda-inferida', `${id}: moneda ausente → ${inferida}`);
  return inferida;
}

function imageFrom(value) {
  if (typeof value === 'string') {
    const url = value.trim();
    if (url.startsWith('//')) return `https:${url}`;
    if (/^https?:\/\//i.test(url)) return url;
    return null;
  }
  if (value && typeof value === 'object') {
    const url = pickText(value, ['url', 'original', 'large', 'image', 'src', 'link', 'medium', 'thumbnail', 'href']);
    return url ? imageFrom(url) : null;
  }
  return null;
}

function extractImages(raw, addIssue, id) {
  const candidates = firstDefined(raw, [
    'images',
    'photos',
    'multimedia',
    'gallery',
    'pictures',
    'real_estate_images',
    'media',
  ]);
  const list = Array.isArray(candidates) ? candidates : candidates !== undefined ? [candidates] : [];
  const imagenes = [];
  const seen = new Set();
  for (const item of list) {
    const url = imageFrom(item);
    if (!url || /youtube|youtu\.be|vimeo|\.mp4|\.webm/i.test(url) || seen.has(url)) continue;
    seen.add(url);
    imagenes.push(url);
    if (imagenes.length >= MAX_IMAGENES) break;
  }
  if (imagenes.length === 0) {
    addIssue('sin-imagenes', `${id}: sin imágenes embebidas → fallback local`);
    return [FALLBACK_IMAGEN];
  }
  return imagenes;
}

function mapCoordenadas(raw, addIssue, id) {
  let lat = pickSigned(raw, ['latitude', 'lat', 'coordinates.1', 'geom.coordinates.1', 'geo.lat']);
  let lng = pickSigned(raw, ['longitude', 'lng', 'lon', 'coordinates.0', 'geom.coordinates.0', 'geo.lng']);
  const validas =
    lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  if (!validas) {
    const wkt = pickText(raw, ['geom', 'geometry', 'point', 'wkt']);
    const match = wkt ? /point\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i.exec(wkt) : null;
    if (match) {
      lng = Number(match[1]);
      lat = Number(match[2]);
    }
  }

  if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    addIssue('sin-coordenadas', `${id}: sin coordenadas válidas → 0,0`);
    return { lat: 0, lng: 0 };
  }
  return { lat, lng };
}

function mapFecha(raw, addIssue, id) {
  const text = pickText(raw, [
    'created_at',
    'publication_date',
    'published_at',
    'publish_date',
    'date',
    'created',
    'updated_at',
  ]);
  if (text) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  addIssue('fecha-fallback', `${id}: fecha de publicación inválida → hoy`);
  return new Date().toISOString().slice(0, 10);
}

function mapCaracteristicas(raw) {
  const rawFeatures = firstDefined(raw, ['features', 'tags', 'amenities', 'attributes', 'caracteristicas', 'extras']);
  if (!Array.isArray(rawFeatures)) return [];
  const caracteristicas = [];
  for (const feature of rawFeatures.slice(0, MAX_CARACTERISTICAS)) {
    const text = stripHtml(textOf(feature) ?? '');
    if (text) caracteristicas.push(text);
  }
  return caracteristicas;
}

function mapProperty(raw, { agency }) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'registro-invalido', detail: 'registro no-objeto' };
  }

  const issues = [];
  const addIssue = (code, detail) => issues.push({ code, detail });

  const rawId = raw.id;
  if (rawId === undefined || rawId === null || rawId === '') {
    return { ok: false, reason: 'sin-id', detail: JSON.stringify(raw).slice(0, 80) };
  }
  const id = `tokko-${rawId}`;

  const titulo = stripHtml(pickText(raw, ['title', 'titulo', 'name']) ?? '');
  if (!titulo) return { ok: false, reason: 'sin-titulo', detail: id };

  const operacion = mapOperacion(raw);
  if (!operacion) {
    const vista = pickText(raw, ['operation.name', 'operation']) ?? '(vacía)';
    return { ok: false, reason: 'operacion-invalida', detail: `${id}: ${vista}` };
  }

  const precio = pickNumber(raw, ['price', 'precio', 'amount', 'value']);
  if (!precio || precio <= 0) return { ok: false, reason: 'sin-precio', detail: id };

  const tipo = mapTipo(raw, addIssue, id);
  const moneda = mapMoneda(raw, operacion, precio, addIssue, id);

  const ambientes = pickNumber(raw, ['rooms', 'ambientes', 'environments', 'ambience']) ?? 0;
  const dormitorios = pickNumber(raw, ['bedrooms', 'dormitorios', 'dorm']) ?? 0;
  const banios = pickNumber(raw, ['bathrooms', 'banios', 'wc']) ?? 0;
  const superficieTotal = pickNumber(raw, ['surface', 'total_surface', 'superficie', 'surface_total']) ?? 0;
  const superficieCubierta = pickNumber(raw, ['covered_surface', 'superficie_cubierta', 'surface_covered']);
  const expensas = pickNumber(raw, ['expenses', 'expensas', 'hoa_fee', 'monthly_expenses']);
  if (superficieTotal === 0) addIssue('sin-superficie', id);
  if (ambientes === 0) addIssue('sin-ambientes', id);

  let zona = pickText(raw, ['zone.name', 'zone', 'neighborhood', 'barrio', 'location.name', 'location']);
  let localidad = pickText(raw, ['locality.name', 'locality', 'city', 'municipality', 'localidad']);
  if (!zona && !localidad) {
    const path = pickText(raw, ['location.path']);
    const segmentos = path ? path.split('>').map((s) => s.trim()).filter(Boolean) : [];
    if (segmentos.length > 0) zona = segmentos[segmentos.length - 1];
  }
  if (!zona && !localidad) addIssue('ubicacion-ausente', id);
  const provincia = pickText(raw, ['state.name', 'state', 'province', 'region']) || 'Buenos Aires';
  const direccion = pickText(raw, ['address', 'street', 'full_address', 'direccion']);
  if (!direccion) addIssue('sin-direccion', id);

  const { lat, lng } = mapCoordenadas(raw, addIssue, id);

  let antiguedad = pickText(raw, ['age', 'antiquity', 'antiguedad', 'years']) || 'No especificada';
  if (/^\d+$/.test(antiguedad)) antiguedad = antiguedad === '0' ? 'A estrenar' : `${antiguedad} años`;

  const piso = pickText(raw, ['floor', 'piso']);
  const orientacion = pickText(raw, ['orientation', 'orientacion']);

  let descripcion = stripHtml(pickText(raw, ['description', 'descripcion', 'summary', 'desc']) ?? '');
  if (!descripcion) {
    descripcion = 'Sin descripción disponible.';
    addIssue('descripcion-vacia', id);
  }

  const rawFeatured = firstDefined(raw, ['featured', 'is_featured', 'highlight', 'destacada']);
  const destacada = rawFeatured === true || rawFeatured === 1 || rawFeatured === 'true' || rawFeatured === '1';

  return {
    ok: true,
    issues,
    property: {
      id,
      slug: `${slugify(titulo) || `propiedad-${rawId}`}-${rawId}`,
      titulo,
      operacion,
      tipo,
      precio,
      moneda,
      ...(expensas !== undefined ? { expensas } : {}),
      ambientes,
      dormitorios,
      banios,
      superficieTotal,
      ...(superficieCubierta !== undefined ? { superficieCubierta } : {}),
      direccion: direccion ?? 'Dirección a confirmar',
      zona: zona ?? localidad ?? 'Sin datos',
      localidad: localidad ?? zona ?? 'Sin datos',
      provincia,
      lat,
      lng,
      antiguedad,
      ...(piso ? { piso } : {}),
      ...(orientacion ? { orientacion } : {}),
      descripcion,
      caracteristicas: mapCaracteristicas(raw),
      imagenes: extractImages(raw, addIssue, id),
      publicadaEn: mapFecha(raw, addIssue, id),
      destacada,
      inmobiliaria: { ...agency },
    },
  };
}

export function mapProperties(rawItems, { agency = AGENCY_DEFAULT } = {}) {
  const properties = [];
  const skipped = [];
  const issueMap = new Map();

  for (const raw of rawItems) {
    const result = mapProperty(raw, { agency });
    if (!result.ok) {
      skipped.push({ reason: result.reason, detail: result.detail });
      continue;
    }
    for (const issue of result.issues) {
      const entry = issueMap.get(issue.code) ?? { code: issue.code, count: 0, samples: [] };
      entry.count += 1;
      if (entry.samples.length < 3 && issue.detail) entry.samples.push(issue.detail);
      issueMap.set(issue.code, entry);
    }
    properties.push(result.property);
  }

  properties.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return {
    properties,
    skipped,
    issues: [...issueMap.values()].sort((a, b) => b.count - a.count),
  };
}
