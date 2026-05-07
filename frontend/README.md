# SupplyLine Frontend

React 19 + TypeScript + Vite single-page app for the SupplyLine MRO Suite.
The backend is a Flask API; see the [root README](../README.md) and
[`BACKEND_API.md`](../BACKEND_API.md) for the full stack overview.

## Stack

- **Build:** Vite, TypeScript
- **UI:** Ant Design (`antd`) on desktop, `antd-mobile` on mobile, Framer
  Motion for transitions, Recharts for analytics
- **State / data:** Redux Toolkit + RTK Query (`baseApi.ts`)
- **Realtime:** `socket.io-client` (see `services/socket.ts`)
- **Routing:** React Router v7
- **Maps / scanning:** `react-leaflet`, `html5-qrcode`
- **Testing:** Vitest + React Testing Library (unit/integration),
  Playwright (E2E across desktop, tablet, and mobile projects)

## Project structure

```
src/
  app/         Redux store, router, providers
  features/    Feature modules (one folder per domain — auth, tools,
               chemicals, kits, orders, scanner, etc.)
  shared/      Cross-feature components, hooks, constants, styles
  services/    API client (RTK Query base), socket client
  components/  Legacy shared components (being migrated to shared/)
  types/       Shared TypeScript types
  test/        Test setup and helpers
tests/         Playwright E2E specs and fixtures
```

Each feature folder follows the same shape: `pages/` for routed views,
`components/` for feature-local UI, `hooks/` for feature-specific hooks,
and `api.ts` for RTK Query endpoints.

## Local development

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

The dev server proxies API calls to the Flask backend; start it with
`python backend/run.py` or `docker-compose up` from the repo root.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint across the project |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest single run (CI) |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:e2e` | Playwright E2E (all projects) |
| `npm run test:e2e:desktop` | Desktop Chromium only |
| `npm run test:e2e:mobile` | Mobile iPhone + Pixel projects |
| `npm run test:e2e:tablet` | Tablet iPad project |
| `npm run test:e2e:ui` | Playwright UI mode for debugging |
| `npm run test:e2e:seed` | Seed the backend with E2E fixtures |

## Environment

Vite reads `.env.development` and `.env.production`. Common keys:

- `VITE_API_URL` — Flask backend base URL (defaults to relative `/api` so
  nginx can proxy).
- `VITE_SOCKET_URL` — Socket.IO origin (defaults to same origin).

Do not commit real `.env` files; use `.env.example` for documented
defaults.

## Conventions

- Logging: keep `console.error` / `console.warn` for genuine error
  paths. Prefer `console.debug` over `console.log` for status-style
  output so it stays out of production users' devtools by default.
- Tests: colocate Vitest specs next to the unit under test
  (`Foo.test.tsx` beside `Foo.tsx`). Playwright specs live under
  `tests/`.
- Imports: feature code imports from `shared/` and `services/`; nothing
  in `shared/` should import from a feature module.
