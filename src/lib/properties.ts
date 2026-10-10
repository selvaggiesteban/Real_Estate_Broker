import type { Property, TipoPropiedad } from './types';
import rawData from '../data/properties.json';

export const properties = rawData as unknown as Property[];

export function getAllProperties(): Property[] {
  return properties;
}

export function getPropertyBySlug(slug: string): Property | undefined {
  return properties.find((property) => property.slug === slug);
}

export function getFeatured(limit = 6): Property[] {
  return properties
    .filter((property) => property.destacada)
    .sort((a, b) => new Date(b.publicadaEn).getTime() - new Date(a.publicadaEn).getTime())
    .slice(0, limit);
}

export function getZonas(): string[] {
  return [...new Set(properties.map((property) => property.zona))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
}

export function getTipoCounts(): Record<TipoPropiedad, number> {
  const counts = {
    departamento: 0,
    casa: 0,
    ph: 0,
    terreno: 0,
    oficina: 0,
    local: 0,
  } satisfies Record<TipoPropiedad, number>;
  for (const property of properties) {
    counts[property.tipo] += 1;
  }
  return counts;
}

export function getRelated(property: Property, limit = 3): Property[] {
  return properties
    .filter((candidate) => candidate.slug !== property.slug)
    .map((candidate) => {
      let score = 0;
      if (candidate.zona === property.zona) score += 3;
      if (candidate.tipo === property.tipo) score += 2;
      if (candidate.operacion === property.operacion) score += 1;
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function getStats() {
  const zonas = getZonas().length;
  const publicadas = properties.map((property) => new Date(property.publicadaEn));
  const ultimaActualizacion = new Date(
    Math.max(...publicadas.map((date) => date.getTime())),
  ).toISOString();
  return {
    totalPropiedades: properties.length,
    totalZonas: zonas,
    venta: properties.filter((property) => property.operacion === 'venta').length,
    alquiler: properties.filter((property) => property.operacion === 'alquiler').length,
    ultimaActualizacion,
  };
}
