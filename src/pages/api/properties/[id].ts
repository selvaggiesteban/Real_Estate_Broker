import type { APIRoute } from 'astro';
import { properties } from '../../../lib/properties';
import type { ApiEnvelope, ApiError, Property } from '../../../lib/types';

export const GET: APIRoute = ({ params }) => {
  const id = params.id?.toLowerCase().trim();

  const property = id
    ? properties.find((item) => item.slug.toLowerCase() === id || item.id.toLowerCase() === id)
    : undefined;

  if (!property) {
    const error: ApiError = {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: `No existe una propiedad con id o slug "${id ?? ''}".`,
      },
    };
    return new Response(JSON.stringify(error), {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      },
    });
  }

  const body: ApiEnvelope<Property> = {
    ok: true,
    data: property,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300',
      'access-control-allow-origin': '*',
    },
  });
};
