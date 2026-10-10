import type { APIRoute } from 'astro';
import { getAllProperties } from '../../lib/properties';
import { applySearch, parseFilters, filtersToSearchParams } from '../../lib/search';
import type { ApiEnvelope, Property } from '../../lib/types';

export const GET: APIRoute = ({ url }) => {
  const filters = parseFilters(url.searchParams);
  const result = applySearch(getAllProperties(), filters);

  const linksFor = (page: number) => {
    const query = filtersToSearchParams({ ...filters, page }).toString();
    return query ? `${url.origin}/api/properties?${query}` : `${url.origin}/api/properties`;
  };

  const body: ApiEnvelope<Property[]> = {
    ok: true,
    data: result.items,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
    links: {
      self: linksFor(result.page),
      first: linksFor(1),
      ...(result.page < result.totalPages ? { next: linksFor(result.page + 1) } : {}),
      ...(result.page > 1 ? { prev: linksFor(result.page - 1) } : {}),
    },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300',
      'access-control-allow-origin': '*',
    },
  });
};
