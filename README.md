# SupplyLine MRO Suite

A comprehensive Maintenance, Repair, and Operations (MRO) management platform for
tool inventory, chemical tracking, mobile warehouse kits, calibration, and
real-time messaging.

**Current Version: 5.3.0**

## Architecture

| Layer    | Stack                                                                      |
|----------|----------------------------------------------------------------------------|
| Backend  | Python 3.11+, Flask, SQLAlchemy, Flask-SocketIO, JWT auth                  |
| Frontend | React 19, TypeScript, Vite, Redux Toolkit (RTK Query), Ant Design 6        |
| Database | SQLite (default) or PostgreSQL                                             |
| Realtime | Socket.IO                                                                  |
| Deploy   | Docker Compose (backend + nginx-served frontend)                           |

## Features

- **Tool management** — inventory, checkouts, calibration, history
- **Chemical management** — lot tracking, waste reporting, analytics, forecasting
- **Mobile warehouse kits** — create kits, issue items, transfer between kits
  and warehouses, reorder workflow
- **Warehouse management** — locations, inventory operations, transfers
- **RBAC & auth** — JWT tokens, roles, departments, TOTP 2FA, password reset
- **Barcode / QR labels** — PDF label generation (4×6, 3×4, 2×4, 2×2 in)
- **Messaging** — real-time channels, kit messages, notifications
- **Reports & analytics** — tools, chemicals, utilization, audit trails
- **Bulk import / export** — CSV-driven data operations

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional, for containerized deployment)

### Local Development

Clone the repo and create a `.env` at the root:

```bash
git clone <your-repo-url>
cd SupplyLine-V2
cp .env.example .env
```

Generate strong secrets (REQUIRED — do not ship the example values):

```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
```

#### Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate            # on Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend listens on `http://localhost:5000`. Verify:

```bash
curl http://localhost:5000/api/health
```

#### Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:5173` and proxies API calls to
the backend. See `frontend/vite.config.ts` for the proxy config.

### Default Credentials

The system seeds a default admin user on first run:

- **Employee Number**: `ADMIN001`
- **Password**: `admin123`

**Change these before deploying anywhere.** See `docs/PASSWORD_MANAGEMENT_IMPLEMENTATION.md`.

### Docker Deployment

```bash
docker-compose up -d
docker-compose logs -f
```

Backend runs on `:5000`, frontend (nginx) on `:80`. See
[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for production guidance.

## Project Structure

```
SupplyLine-V2/
├── backend/                  # Flask backend API
│   ├── app.py                # Application factory
│   ├── config.py             # Configuration
│   ├── run.py                # Dev entry point
│   ├── models.py             # Core SQLAlchemy models
│   ├── models_kits.py        # Kit-related models
│   ├── models_messaging.py   # Messaging models
│   ├── routes_*.py           # Route blueprints per domain
│   ├── migrations/           # Database migration scripts
│   └── tests/                # pytest suite
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── app/              # Redux store, hooks
│   │   ├── features/         # Feature modules (auth, kits, chemicals, …)
│   │   ├── services/         # API clients (baseApi, socket)
│   │   └── shared/           # Shared components, hooks, contexts
│   ├── tests/                # Playwright E2E tests
│   └── package.json
├── docs/                     # Project documentation
├── scripts/                  # Helper scripts
├── docker-compose.yml
├── .env.example
└── README.md                 # This file
```

## Testing

### Backend

```bash
cd backend
pytest                              # full suite
pytest tests/test_auth.py           # specific file
pytest --cov                        # with coverage
```

See [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for detailed guidance.

### Frontend

```bash
cd frontend
npm run test            # Vitest unit tests (watch)
npm run test:run        # single-run
npm run lint            # ESLint
npx playwright test     # E2E (Playwright)
```

## Documentation

### Getting Started
- [QUICK_START.md](QUICK_START.md) — Quick start for the user management flows
- [UPDATING.md](UPDATING.md) — Update / upgrade procedures

### Backend
- [BACKEND_API.md](BACKEND_API.md) — API module reference
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) — Full REST API reference

### Features
- [docs/KITS_USER_GUIDE.md](docs/KITS_USER_GUIDE.md) — Kits user guide
- [docs/BARCODE_SYSTEM.md](docs/BARCODE_SYSTEM.md) — Barcode / label system
- [docs/WAREHOUSE_MANAGEMENT.md](docs/WAREHOUSE_MANAGEMENT.md) — Warehouse ops
- [docs/EXPENDABLES_SYSTEM.md](docs/EXPENDABLES_SYSTEM.md) — Expendables
- [docs/MESSAGING_INFRASTRUCTURE.md](docs/MESSAGING_INFRASTRUCTURE.md) — Messaging

### Security
- [SECURITY_SETUP.md](SECURITY_SETUP.md) — Required security configuration
- [SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md) — Security posture audit
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — Known issues and mitigations
- [PASSWORD_MANAGEMENT_USER_GUIDE.md](PASSWORD_MANAGEMENT_USER_GUIDE.md) — End-user password guide

### Release info
- [CHANGELOG.md](CHANGELOG.md)
- [RELEASE_NOTES.md](RELEASE_NOTES.md)

### Developer docs
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — Repository guidelines
- [docs/BRANCH_STRATEGY.md](docs/BRANCH_STRATEGY.md) — Branch conventions
- [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) — Testing guide

## Environment Variables

See `.env.example` for the full list. Key variables:

| Name                | Required | Notes                                       |
|---------------------|:--------:|---------------------------------------------|
| `SECRET_KEY`        | ✓        | Flask secret. Generate with `secrets`.      |
| `JWT_SECRET_KEY`    | ✓        | JWT signing key. Generate with `secrets`.   |
| `FLASK_ENV`         |          | `development` or `production`.              |
| `FLASK_DEBUG`       |          | `True` / `False`.                           |
| `CORS_ORIGINS`      |          | Comma-separated allowed origins.            |
| `DATABASE_URL`      |          | PostgreSQL URL; defaults to SQLite.         |
| `PUBLIC_URL`        |          | Public URL used in QR codes.                |

## Production Checklist

1. Generate strong, unique `SECRET_KEY` and `JWT_SECRET_KEY`.
2. Set `FLASK_ENV=production` and `FLASK_DEBUG=False`.
3. Configure `CORS_ORIGINS` for your domain.
4. Change default user credentials.
5. Put the backend behind HTTPS (nginx / Traefik / CloudFront).
6. Configure regular database backups (see [docs/DATABASE_PERSISTENCE.md](docs/DATABASE_PERSISTENCE.md)).
7. Review [SECURITY_SETUP.md](SECURITY_SETUP.md).

## License

Copyright © 2025 SupplyLine MRO Suite. All rights reserved.
