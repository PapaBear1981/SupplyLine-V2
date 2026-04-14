# SupplyLine MRO Suite — Frontend

React + TypeScript frontend for the SupplyLine MRO Suite backend API. Built with
Vite, Redux Toolkit (RTK Query), and Ant Design 6.

For an overview of the whole project, see the
[root README](../README.md).

## Stack

- **React 19** + **TypeScript 5.9** (strict mode)
- **Vite 7** for dev server and build
- **Redux Toolkit** + **RTK Query** for state and data fetching
- **Ant Design 6** (desktop) and **Ant Design Mobile** for UI
- **React Router 7** for routing
- **Socket.IO Client** for realtime updates
- **Recharts** for charts and analytics
- **Leaflet** for map views
- **Vitest** for unit tests, **Playwright** for E2E

## Getting Started

Assumes Node.js 20+.

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:5173` and proxies `/api/*` and
`/socket.io/*` to the backend running on `http://localhost:5000`.
See `vite.config.ts` for the proxy configuration.

Start the backend in another terminal first — see the
[backend README](../backend/README.md) or the
[root README](../README.md#start-the-backend).

## Scripts

| Command             | What it does                                        |
|---------------------|-----------------------------------------------------|
| `npm run dev`       | Start Vite dev server with HMR                      |
| `npm run build`     | Type-check (`tsc -b`) and build for production      |
| `npm run preview`   | Preview the production build                        |
| `npm run lint`      | Run ESLint                                          |
| `npm run test`      | Run Vitest in watch mode                            |
| `npm run test:run`  | Run Vitest once (CI-friendly)                       |
| `npm run test:coverage` | Run Vitest with coverage                        |
| `npx playwright test` | Run E2E tests against a live backend              |

## Project Layout

```
frontend/src/
├── app/                    # Redux store, typed hooks
├── assets/                 # Static assets imported by code
├── components/shared/      # Legacy shared components
├── features/               # Feature modules (one per domain)
│   ├── admin/
│   ├── ai/
│   ├── auth/
│   ├── chemicals/
│   ├── dashboard/
│   ├── kits/
│   ├── orders/
│   ├── profile/
│   ├── reports/
│   ├── settings/
│   ├── tool-checkout/
│   ├── tools/
│   ├── users/
│   └── warehouses/
├── services/               # HTTP (baseApi) and Socket clients
├── shared/                 # Shared components, hooks, contexts, constants
├── test/                   # Test setup and utilities
├── types/                  # Global TypeScript types
├── App.tsx                 # Top-level app shell and routing
└── main.tsx                # Entry point
```

Each feature module typically contains `pages/`, `components/`, and `hooks/`,
with its RTK Query endpoints alongside. Prefer adding new code to `features/`
rather than the legacy `components/shared/`.

## Tooling Notes

- **Strict TypeScript** (`tsconfig.app.json`): `strict: true`, `noUnusedLocals`,
  `noUnusedParameters`. Any unused symbol is a build error — keep the tree clean.
- **ESLint flat config** (`eslint.config.js`): `@eslint/js`, `typescript-eslint`,
  `react-hooks`, `react-refresh`.
- **Path aliases** (see `vite.config.ts`): `@/`, `@app/`, `@features/`,
  `@services/`, `@shared/`.
- **Testing**: Vitest + React Testing Library for unit tests; Playwright for
  end-to-end.

## Production Build

```bash
npm run build
```

Emits the production bundle to `dist/`. The Docker image (`Dockerfile`) builds
the bundle and serves it via nginx — see `nginx.conf`.
