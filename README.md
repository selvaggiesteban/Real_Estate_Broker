<p align="center">
  <img src="public/images/properties/depto-exterior.svg" alt="Real Estate Broker" width="120" />
</p>

<h1 align="center">Real Estate Broker</h1>

<p align="center">
  <strong>Motor de búsqueda inmobiliaria con API pública</strong><br/>
  MVP del ecosistema Real Estate Broker: el ERP white-label multi-tenant para inmobiliarias.
</p>

<p align="center">
  <a href="https://github.com/selvaggiesteban/Real_Estate_Broker/actions/workflows/ci.yml"><img src="https://github.com/selvaggiesteban/Real_Estate_Broker/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-MIT-blue?style=flat-square" alt="Licencia MIT" /></a>
  <img src="https://img.shields.io/badge/Astro-v5-orange?style=flat-square" alt="Astro 5" />
  <img src="https://img.shields.io/badge/Cloudflare-Pages-purple?style=flat-square" alt="Cloudflare Pages" />
  <img src="https://img.shields.io/badge/API-p%C3%BAblica%20REST-2ea44f?style=flat-square" alt="API REST" />
</p>

---

## 🧭 ¿Qué es?

**Real Estate Broker** es un buscador de publicaciones inmobiliarias al estilo [Zonaprop](https://www.zonaprop.com.ar) / [Tokko Broker](https://www.tokkobroker.com): los usuarios filtran por **operación, tipo, zona, ambientes, superficie y precio**, comparan fichas normalizadas y contactan a la inmobiliaria responsable. Todo el inventario además está expuesto como **API REST pública** en el edge de Cloudflare.

Este buscador es el **MVP** de una ambición mayor: un **ERP de marca blanca (white-label) multi-tenant**, con licencias y venta de suscripciones para inmobiliarias — ver [Roadmap E2E](#-roadmap-e2e-erp-white-label).

| | |
|---|---|
| 🔍 **Buscador SSR** | Filtros, ordenamiento y paginación resueltos en el servidor sobre Cloudflare Workers |
| 🔌 **API pública** | `GET /api/properties`, detalle, healthcheck y recepción de leads — CORS abierto y cache en CDN |
| 🎨 **Diseño portal** | UI tipo portal inmobiliario: hero con buscador, destacadas, fichas con galería, mapa y contacto |
| ☁️ **Deploy continuo** | `git push` → GitHub → Cloudflare Pages (`npm run build` → `dist/` → edge) |
| 🧩 **Listo para white-label** | Arquitectura preparada para multi-tenant: branding por tenant sobre el mismo motor |

## ✨ Funcionalidades (MVP)

- **Home** con buscador destacado, estadísticas, propiedades destacadas y accesos por tipo de propiedad.
- **`/propiedades`** con sidebar de filtros (tipo, zona, ambientes, precio, superficie), chips de filtros activos, ordenamiento (reciente / precio / superficie) y paginación.
- **`/propiedades/{slug}`** con galería, características, descripción, mapa (OpenStreetMap), datos de la inmobiliaria y contacto directo (email, WhatsApp, teléfono). Incluye **JSON-LD `RealEstateListing`** para SEO.
- **`/api-docs`** con la documentación completa de la API pública.
- **`/marcas-blancas`** con la propuesta ERP white-label, módulos, planes de licencia y FAQ.
- Sitemap, robots.txt, canonical, Open Graph y 404 diseñada.

## 🏗 Arquitectura

```
┌────────────────────────────────────────────────────────────┐
│  GitHub  (main)                                            │
│    │  git push                                             │
│    ├─────────────────────────────┐                         │
│    ▼                             ▼                         │
│  Cloudflare Pages          GitHub Actions (CI)             │
│  (integración Git)         typecheck + build               │
│    │  npm run build                                             │
│    ▼                                                           │
│  Astro 5 (output: server)  →  dist/ + _worker.js          │
│    │                                                           │
│    ▼                                                           │
│  Cloudflare Workers (edge)                                   │
│    ├─ Páginas SSR  (/ , /propiedades, /propiedades/[slug])  │
│    └─ API JSON     (/api/properties, /api/health, …)        │
└────────────────────────────────────────────────────────────┘
```

- **Runtime**: Workers via `@astrojs/cloudflare` (SSR en el edge, sin servidor propio).
- **Config**: `wrangler.jsonc` declara `"pages_build_output_dir": "dist/"`, que es lo que Cloudflare Pages interpreta como **integración Git directa**: el build del proyecto usa esa carpeta como output.
- **Datos**: dataset versionado (`src/data/properties.json`) con un motor de búsqueda puro en TypeScript (`src/lib/search.ts`) — sin dependencias, testeable y reemplazable por D1/KV sin tocar la UI.

## 🚀 Deploy en Cloudflare Pages

### Flujo principal: integración Git (recomendado)

```
git push a main → Cloudflare Pages detecta el push
                → npm run build (Astro SSR)
                → deploy a dist/
```

1. Creá el proyecto en **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git** y seleccioná `selvaggiesteban/Real_Estate_Broker`.
2. Build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist/`
3. En **Settings → Build & deploy → Production branch** asegurate de que apunte a `main`.
4. Cada `git push` a `main` genera un deploy automático en `*.pages.dev` (y en el dominio propio si lo configurás).

> Si el proyecto ya existe pero no está conectado a la rama, la conexión se arma en
> **Dashboard → Pages → Real Estate Broker → Settings → Build & deploy → Production branch**.

### Alternativa: deploy desde GitHub Actions

El workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) compila y publica con `wrangler pages deploy dist`. Para activarlo:

1. `Settings → Secrets and variables → Actions → Secrets`: crear `CLOUDFLARE_API_TOKEN` (permisos: Account / Cloudflare Pages / Edit) y `CLOUDFLARE_ACCOUNT_ID`.
2. `… → Variables`: crear `CLOUDFLARE_PAGES_DEPLOY` = `true`.

⚠️ Si ya usás la integración Git del dashboard, **no actives esta variable** para evitar deploys duplicados. El workflow manual (`workflow_dispatch`) siempre queda disponible desde la pestaña Actions.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push/PR: `npm ci` → `astro check` (tipos) → `astro build` → artefacto `dist/`.

## 💻 Desarrollo local

```bash
# 1. Instalar dependencias (Node.js >= 22.12)
npm install

# 2. Servidor de desarrollo con SSR (astro dev + workerd)
npm run dev        # http://localhost:4321

# 3. Typecheck + build de producción
npm run check
npm run build      # genera dist/

# 4. Preview del build (vía wrangler pages dev)
npx wrangler pages dev dist
```

Variables de entorno: ninguna requerida para el MVP. `.dev.vars` queda reservado para secretos futuros (API keys, webhooks).

## 📡 API pública

**Base URL**: `https://real-estate-broker.pages.dev/api` · Documentación completa en [`/api-docs`](https://real-estate-broker.pages.dev/api-docs)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Healthcheck del servicio |
| `GET` | `/api/properties` | Listado con filtros, orden y paginación |
| `GET` | `/api/properties/{id}` | Detalle por `id` (ej. `p001`) o `slug` |
| `POST` | `/api/leads` | Recepción de consultas de contacto |

**Parámetros de `/api/properties`**: `operacion`, `tipo`, `zona` (repetibles o coma-separados), `ambientes`, `precio_min`, `precio_max`, `superficie_min`, `orden` (`recientes` \| `precio-asc` \| `precio-desc` \| `superficie-desc`), `page`, `limit` (máx. 48).

```bash
curl "https://real-estate-broker.pages.dev/api/properties?operacion=venta&tipo=departamento&zona=palermo&precio_max=200000&orden=precio-asc"
```

```json
{
  "ok": true,
  "data": [ { "id": "p001", "slug": "departamento-venta-palermo-3-ambientes", "precio": 189000, "moneda": "USD", "zona": "Palermo" } ],
  "meta": { "total": 1, "page": 1, "limit": 12, "totalPages": 1 },
  "links": { "self": "…", "first": "…", "next": "…" }
}
```

Errores: envelope `{ "ok": false, "error": { "code", "message" } }` con códigos `NOT_FOUND` (404), `VALIDATION_ERROR` / `INVALID_JSON` (400).

## 📁 Estructura del proyecto

```
Real_Estate_Broker/
├── .github/workflows/
│   ├── ci.yml                  # Typecheck + build en cada push/PR
│   └── deploy-pages.yml        # Deploy alternativo vía wrangler-action
├── public/
│   ├── images/properties/      # Ilustraciones SVG de las publicaciones
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/             # Header, Footer, SearchBar, FilterSidebar, PropertyCard, Pagination
│   ├── data/properties.json    # Inventario versionado (MVP)
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── search.ts           # Motor de búsqueda: filtros, orden, paginación
│   │   ├── properties.ts       # Repositorio de datos (reemplazable por D1/KV)
│   │   ├── types.ts            # Tipos del dominio
│   │   └── format.ts           # Formateo es-AR (precios, fechas, m²)
│   ├── pages/
│   │   ├── index.astro         # Home
│   │   ├── propiedades/        # Listado + detalle SSR
│   │   ├── api/                # API REST pública
│   │   ├── api-docs.astro      # Documentación
│   │   ├── marcas-blancas.astro# Pitch ERP white-label
│   │   └── 404.astro
│   └── styles/global.css       # Tailwind v4 + design tokens (brand/accent)
├── astro.config.mjs            # output: server + adapter cloudflare
├── wrangler.jsonc              # pages_build_output_dir: "dist/"
├── package.json
└── LICENSE                     # MIT
```

## 🛣 Roadmap E2E: ERP white-label

El MVP es el buscador. El producto final (**E2E**) es un **ERP inmobiliario de marca blanca multi-tenant**:

| Fase | Módulo | Descripción |
|------|--------|-------------|
| ✅ MVP | **Portal de publicaciones** | Buscador SSR + API pública (este repo) |
| Fase 2 | **CRM de leads** | Consultas del portal/WhatsApp con asignación y seguimiento; `POST /api/leads` ya expuesto |
| Fase 2 | **Backoffice de inventario** | Altas/bajas de publicaciones, destacadas, media |
| Fase 3 | **Multi-tenancy** | Tenant por host/subdominio, branding por tokens (logo, colores, tipografía), aislamiento de datos |
| Fase 3 | **D1 + Auth** | Postgres-compatible en Cloudflare D1, roles (admin, agente, propietario) |
| Fase 4 | **Contratos y reservas** | Señas, boletas, contratos de locación/venta |
| Fase 4 | **Facturación y licencias** | Planes Starter / Pro / Enterprise, límites facturables, cobros recurrentes (ej. Mercado Pago / Stripe) |
| Fase 5 | **Sincronización de portales** | Zonaprop, Argenprop, Mercado Libre Inmuebles + webhooks |
| Fase 5 | **Portal de clientes** | Área privada de propietarios e inquilinos |

**Principios de arquitectura multi-tenant:**

1. Un tenant = una marca: `tenant.realestatebroker.com` o dominio propio resuelto por host.
2. El branding se inyecta como tokens (CSS variables + config), nunca como forks del código.
3. Los datos se aislán por `tenant_id` (row-level security apuntando a D1).
4. Las licencias se modelan como planes con límites (publicaciones, usuarios, sucursales) facturables por suscripción.

La página [`/marcas-blancas`](src/pages/marcas-blancas.astro) ya comunica esta propuesta con planes y FAQ.

## 🧰 Stack técnico

| Capa | Tecnología |
|------|------------|
| Framework | [Astro 5](https://astro.build) (`output: server`, SSR) |
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com) vía `@astrojs/cloudflare` v12 (modo Pages) |
| Estilos | [Tailwind CSS v4](https://tailwindcss.com) (Vite plugin, design tokens en `@theme`) |
| Deploy | [Cloudflare Pages](https://pages.cloudflare.com) (Git integration o `wrangler pages deploy`) |
| CI/CD | GitHub Actions (`ci.yml`, `deploy-pages.yml`) |
| Lenguaje | TypeScript (estricto, `astro check` en CI) |

> **¿Por qué Astro 5 + adapter v12?** El `@astrojs/cloudflare` v13 (Astro 6) **eliminó el soporte de
> Cloudflare Pages** ([nota de migración](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#removed-cloudflare-pages-support)).
> Para mantener el flujo pedido —`pages_build_output_dir: "dist/"` + integración Git de Pages—
> el proyecto está anclado en Astro 5 + adapter v12, que emite `dist/_worker.js` (Pages advanced mode).
> La migración futura a Workers es directa: `npx wrangler deploy` sobre el mismo código.

## ✅ Convenciones

- Commits en inglés o español imperativo, formato convencional sugerido: `feat(search): …`, `fix(api): …`, `docs: …`.
- Toda función del motor de búsqueda vive en `src/lib/` y no depende de Astro (unit-testeable).
- Los endpoints responden siempre el envelope `{ ok, data, meta?, links? }` o `{ ok: false, error }`.
- Assets visuales en SVG inline en `/public/images` (cero costo de licencias, builds offline).

## 📄 Licencia

[MIT](LICENSE) © 2026 [Esteban Selvaggi](https://selvaggiesteban.dev)

---

<p align="center">
  Hecho con ❤️ en Buenos Aires · Astro + Cloudflare · <a href="https://github.com/selvaggiesteban/Real_Estate_Broker">github.com/selvaggiesteban/Real_Estate_Broker</a>
</p>
