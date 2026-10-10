const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export function formatPrice(precio: number, moneda: 'USD' | 'ARS'): string {
  const value = numberFormat.format(precio);
  return moneda === 'USD' ? `USD ${value}` : `$${value} ARS`;
}

export function formatExpensas(expensas: number): string {
  return `$${numberFormat.format(expensas)} ARS`;
}

export function formatSuperficie(m2: number): string {
  return `${numberFormat.format(m2)} m²`;
}

export function pluralAmbientes(ambientes: number): string {
  if (ambientes <= 0) return 'sin ambientes';
  if (ambientes === 1) return '1 ambiente';
  return `${ambientes} ambientes`;
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
