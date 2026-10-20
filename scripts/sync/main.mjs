#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchAllProperties, fetchInactiveCount, TokkoError } from './tokko-client.mjs';
import { mapProperties, AGENCY_DEFAULT } from './map.mjs';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/property.sample.json', import.meta.url));
const PROPERTIES_PATH = fileURLToPath(new URL('../../src/data/properties.json', import.meta.url));

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const flagValue = (name) => {
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : undefined;
};

const log = (message) => console.log(`[sync] ${message}`);
const fail = (message) => {
  console.error(`[sync] error: ${message}`);
  process.exit(1);
};

const agency = {
  nombre: process.env.AGENCY_NAME || AGENCY_DEFAULT.nombre,
  telefono: process.env.AGENCY_PHONE || AGENCY_DEFAULT.telefono,
  email: process.env.AGENCY_EMAIL || AGENCY_DEFAULT.email,
};

async function readMaybe(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function loadFixtureItems() {
  const raw = await readMaybe(FIXTURE_PATH);
  if (raw === null) fail(`fixture no encontrado: ${FIXTURE_PATH}`);
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  if (items.length === 0) fail('el fixture no contiene registros');
  return { items, expected: Array.isArray(parsed) ? undefined : parsed.expected };
}

async function runSelfTest() {
  const { items, expected } = await loadFixtureItems();
  const { properties, skipped, issues } = mapProperties(items, { agency });
  const failures = [];
  const assert = (condition, message) => {
    if (!condition) failures.push(message);
  };

  assert(skipped.length === 0, `registros descartados: ${JSON.stringify(skipped)}`);
  assert(properties.length === items.length, `mapeadas ${properties.length}/${items.length}`);
  assert(new Set(properties.map((p) => p.slug)).size === properties.length, 'slugs duplicados');

  for (const property of properties) {
    assert(property.precio > 0, `${property.id}: precio inválido`);
    assert(['venta', 'alquiler'].includes(property.operacion), `${property.id}: operación inválida`);
    assert(['USD', 'ARS'].includes(property.moneda), `${property.id}: moneda inválida`);
    assert(property.imagenes.length > 0, `${property.id}: sin imágenes`);
    assert(!property.descripcion.includes('<'), `${property.id}: HTML en descripción`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(property.publicadaEn), `${property.id}: fecha inválida`);
    assert(
      Math.abs(property.lat) <= 90 && Math.abs(property.lng) <= 180,
      `${property.id}: coordenadas fuera de rango`,
    );
  }

  if (expected) {
    const seq = (key) => JSON.stringify(properties.map((p) => p[key]));
    if (expected.ids) assert(seq('id') === JSON.stringify(expected.ids), `ids: ${seq('id')}`);
    if (expected.operaciones) {
      assert(seq('operacion') === JSON.stringify(expected.operaciones), `operaciones: ${seq('operacion')}`);
    }
    if (expected.tipos) assert(seq('tipo') === JSON.stringify(expected.tipos), `tipos: ${seq('tipo')}`);
    if (expected.monedas) assert(seq('moneda') === JSON.stringify(expected.monedas), `monedas: ${seq('moneda')}`);
    if (expected.firstSlugEndsWith) {
      assert(properties[0]?.slug.endsWith(expected.firstSlugEndsWith), `slug: ${properties[0]?.slug}`);
    }
    if (expected.firstFecha) {
      assert(properties[0]?.publicadaEn === expected.firstFecha, `fecha: ${properties[0]?.publicadaEn}`);
    }
    if (expected.secondAntiguedad) {
      assert(properties[1]?.antiguedad === expected.secondAntiguedad, `antigüedad: ${properties[1]?.antiguedad}`);
    }
    for (const code of expected.mustIncludeIssues ?? []) {
      assert(issues.some((issue) => issue.code === code), `falta incidencia: ${code}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    fail(`self-test con ${failures.length} fallo(s)`);
  }
  const resumen = issues.map((issue) => `${issue.code}×${issue.count}`).join(', ') || 'ninguna';
  log(`self-test OK — ${properties.length} propiedades · incidencias: ${resumen}`);
}

async function pullRaw() {
  if (hasFlag('--fixtures')) {
    const { items } = await loadFixtureItems();
    log(`usando fixtures locales (${items.length} registros).`);
    return { items, total: items.length, inactive: undefined };
  }

  const apiKey = (process.env.TOKKO_API_KEY ?? '').trim();
  if (!apiKey) {
    log('skip: TOKKO_API_KEY no configurado — se conserva el dataset actual.');
    process.exit(0);
  }

  const maxPages = Number(flagValue('--limit-pages')) || Infinity;
  try {
    const { items, total } = await fetchAllProperties(apiKey, {
      maxPages,
      onProgress: ({ page, fetched, total: apiTotal }) =>
        log(`página ${page}: ${fetched}${apiTotal !== undefined ? `/${apiTotal}` : ''} propiedades`),
    });
    const inactive = await fetchInactiveCount(apiKey);
    return { items, total, inactive };
  } catch (error) {
    if (error instanceof TokkoError) fail(error.message);
    throw error;
  }
}

function printSummary({ origen, total, inactive, properties, skipped, issues }) {
  log(`origen: ${origen} · API: ${total ?? '—'} · mapeadas: ${properties.length}`);
  if (inactive !== undefined) log(`bajas en Tokko (inactiveproperty): ${inactive}`);
  if (skipped.length > 0) {
    const porMotivo = {};
    for (const item of skipped) porMotivo[item.reason] = (porMotivo[item.reason] ?? 0) + 1;
    const detalle = Object.entries(porMotivo)
      .map(([motivo, count]) => `${motivo}: ${count}`)
      .join(', ');
    log(`descartadas: ${skipped.length} (${detalle})`);
    for (const item of skipped.slice(0, 5)) log(`  - ${item.reason}: ${item.detail}`);
  }
  for (const issue of issues) {
    log(`incidencia ${issue.code} ×${issue.count}`);
    for (const sample of issue.samples) log(`    · ${sample}`);
  }
}

async function run() {
  if (hasFlag('--self-test')) {
    await runSelfTest();
    return;
  }

  const { items, total, inactive } = await pullRaw();
  const { properties, skipped, issues } = mapProperties(items, { agency });

  if (properties.length === 0) {
    fail('0 propiedades mapeables — guard anti-vacío: no se escribe nada.');
  }
  const slugs = new Set(properties.map((p) => p.slug));
  if (slugs.size !== properties.length) {
    fail('slugs duplicados tras el mapeo.');
  }

  printSummary({
    origen: hasFlag('--fixtures') ? 'fixtures' : 'API Tokko',
    total,
    inactive,
    properties,
    skipped,
    issues,
  });

  if (hasFlag('--capture') && !hasFlag('--fixtures')) {
    const capture = {
      note: `Payload real de Tokko capturado el ${new Date().toISOString()}. Reemplaza el fixture artesanal; el self-test pasa a modo genérico (sin bloque "expected").`,
      items: items.slice(0, 2),
    };
    await writeFile(FIXTURE_PATH, `${JSON.stringify(capture, null, 2)}\n`);
    log(`fixture actualizado con payloads reales (${Math.min(2, items.length)} registro(s)).`);
  }

  const target = flagValue('--out') ?? PROPERTIES_PATH;
  const json = `${JSON.stringify(properties, null, 2)}\n`;
  const current = await readMaybe(target);

  if (current === json) {
    log(`sin cambios: ${target}`);
    return;
  }
  if (hasFlag('--dry-run')) {
    log(`dry-run: no se escribe (${properties.length} propiedades, ${json.length} bytes).`);
    return;
  }
  await writeFile(target, json);
  log(`escrito: ${target} (${properties.length} propiedades).`);
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
