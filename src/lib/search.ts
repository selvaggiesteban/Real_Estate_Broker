import type {
  Operacion,
  Orden,
  PaginatedResult,
  Property,
  SearchFilters,
  TipoPropiedad,
} from './types';
import { OPERACIONES, ORDENES, TIPOS_PROPIEDAD } from './types';

export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 48;

export function emptyFilters(): SearchFilters {
  return {
    tipos: [],
    zonas: [],
    orden: 'recientes',
    page: 1,
    limit: DEFAULT_LIMIT,
  };
}

function collect(params: URLSearchParams, key: string): string[] {
  const values: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(',')) {
      const value = part.trim().toLowerCase();
      if (value) values.push(value);
    }
  }
  return [...new Set(values)];
}

function toInt(value: string | null, min: number, max: number): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
}

export function parseFilters(params: URLSearchParams): SearchFilters {
  const filters = emptyFilters();

  const operacion = params.get('operacion')?.trim().toLowerCase();
  if (operacion && (OPERACIONES as readonly string[]).includes(operacion)) {
    filters.operacion = operacion as Operacion;
  }

  filters.tipos = collect(params, 'tipo').filter((tipo): tipo is TipoPropiedad =>
    (TIPOS_PROPIEDAD as readonly string[]).includes(tipo),
  );

  filters.zonas = collect(params, 'zona');

  filters.ambientes = toInt(params.get('ambientes'), 1, 10);
  filters.precioMin = toInt(params.get('precio_min'), 0, 100_000_000);
  filters.precioMax = toInt(params.get('precio_max'), 0, 100_000_000);
  filters.superficieMin = toInt(params.get('superficie_min'), 0, 100_000);

  const orden = params.get('orden')?.trim().toLowerCase();
  if (orden && (ORDENES as readonly string[]).includes(orden)) {
    filters.orden = orden as Orden;
  }

  filters.page = toInt(params.get('page'), 1, 10_000) ?? 1;
  filters.limit = toInt(params.get('limit'), 1, MAX_LIMIT) ?? DEFAULT_LIMIT;

  if (
    filters.precioMin !== undefined &&
    filters.precioMax !== undefined &&
    filters.precioMin > filters.precioMax
  ) {
    [filters.precioMin, filters.precioMax] = [filters.precioMax, filters.precioMin];
  }

  return filters;
}

export function matchesFilters(property: Property, filters: SearchFilters): boolean {
  if (filters.operacion && property.operacion !== filters.operacion) return false;
  if (filters.tipos.length > 0 && !filters.tipos.includes(property.tipo)) return false;
  if (filters.zonas.length > 0 && !filters.zonas.includes(property.zona.toLowerCase())) return false;
  if (filters.ambientes !== undefined && property.ambientes !== filters.ambientes) return false;
  if (filters.precioMin !== undefined && property.precio < filters.precioMin) return false;
  if (filters.precioMax !== undefined && property.precio > filters.precioMax) return false;
  if (filters.superficieMin !== undefined && property.superficieTotal < filters.superficieMin) {
    return false;
  }
  return true;
}

function sortProperties(items: Property[], orden: Orden): Property[] {
  const sorted = [...items];
  switch (orden) {
    case 'precio-asc':
      return sorted.sort((a, b) => a.precio - b.precio);
    case 'precio-desc':
      return sorted.sort((a, b) => b.precio - a.precio);
    case 'superficie-desc':
      return sorted.sort((a, b) => b.superficieTotal - a.superficieTotal);
    case 'recientes':
    default:
      return sorted.sort(
        (a, b) => new Date(b.publicadaEn).getTime() - new Date(a.publicadaEn).getTime(),
      );
  }
}

export function applySearch(all: Property[], filters: SearchFilters): PaginatedResult<Property> {
  const filtered = sortProperties(
    all.filter((property) => matchesFilters(property, filters)),
    filters.orden,
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.limit;

  return {
    items: filtered.slice(start, start + filters.limit),
    total,
    page,
    limit: filters.limit,
    totalPages,
  };
}

export function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.operacion) params.set('operacion', filters.operacion);
  for (const tipo of filters.tipos) params.append('tipo', tipo);
  for (const zona of filters.zonas) params.append('zona', zona);
  if (filters.ambientes) params.set('ambientes', String(filters.ambientes));
  if (filters.precioMin !== undefined) params.set('precio_min', String(filters.precioMin));
  if (filters.precioMax !== undefined) params.set('precio_max', String(filters.precioMax));
  if (filters.superficieMin !== undefined) params.set('superficie_min', String(filters.superficieMin));
  if (filters.orden !== 'recientes') params.set('orden', filters.orden);
  return params;
}

export function countActiveFilters(filters: SearchFilters): number {
  return (
    (filters.operacion ? 1 : 0) +
    filters.tipos.length +
    filters.zonas.length +
    (filters.ambientes ? 1 : 0) +
    (filters.precioMin !== undefined ? 1 : 0) +
    (filters.precioMax !== undefined ? 1 : 0) +
    (filters.superficieMin !== undefined ? 1 : 0)
  );
}
