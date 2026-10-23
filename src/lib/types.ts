export const OPERACIONES = ['venta', 'alquiler'] as const;
export type Operacion = (typeof OPERACIONES)[number];

export const TIPOS_PROPIEDAD = [
  'departamento',
  'casa',
  'ph',
  'terreno',
  'oficina',
  'local',
] as const;
export type TipoPropiedad = (typeof TIPOS_PROPIEDAD)[number];

export const ORDENES = ['recientes', 'precio-asc', 'precio-desc', 'superficie-desc'] as const;
export type Orden = (typeof ORDENES)[number];

export const ORDENES_LABEL: Record<Orden, string> = {
  recientes: 'Más recientes',
  'precio-asc': 'Menor precio',
  'precio-desc': 'Mayor precio',
  'superficie-desc': 'Mayor superficie',
};

export interface Agency {
  nombre: string;
  telefono: string;
  email: string;
}

export interface Property {
  id: string;
  slug: string;
  titulo: string;
  operacion: Operacion;
  tipo: TipoPropiedad;
  precio: number;
  moneda: 'USD' | 'ARS';
  expensas?: number;
  ambientes: number;
  dormitorios: number;
  banios: number;
  superficieTotal: number;
  superficieCubierta?: number;
  direccion: string;
  zona: string;
  localidad: string;
  provincia: string;
  lat: number;
  lng: number;
  antiguedad: string;
  piso?: string;
  orientacion?: string;
  descripcion: string;
  caracteristicas: string[];
  imagenes: string[];
  publicadaEn: string;
  destacada: boolean;
  inmobiliaria: Agency;
}

export interface Lead {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  propiedad: string;
  mensaje: string;
  source: string;
  created_at: string;
}

export interface SearchFilters {
  operacion?: Operacion;
  tipos: TipoPropiedad[];
  zonas: string[];
  ambientes?: number;
  precioMin?: number;
  precioMax?: number;
  superficieMin?: number;
  orden: Orden;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  ok: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  links?: {
    self: string;
    first: string;
    next?: string;
    prev?: string;
  };
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}
