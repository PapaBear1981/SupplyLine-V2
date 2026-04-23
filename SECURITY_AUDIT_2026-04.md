# Production Security Audit — April 2026

**Scope:** Full security audit of the production Render + Supabase-Postgres
deployment, including the Playwright E2E rebuild merged in PR #67.
**Audit branch:** `claude/security-audit-production-fK1ky`
**Base commit:** `0a841b4` (master at the time of audit)

## TL;DR

Three classes of issues were fixed:

1. **Actively broken security in production** — headers shipping with typos,
   real client IPs not reaching the app, a never-applied CSP, and the
   WebSocket token leaking into proxy access logs.
2. **Newly introduced test-mode escape hatches** from the E2E rebuild that
   could, if misconfigured, disable 2FA, disable rate limiting, or wipe the
   production database.
3. **Pre-existing hardening gaps** — JWT `iss`/`aud` missing, localStorage
   token exfil risk, account lockout never enforced, Docker base images
   unpinned, GITHUB_TOKEN over-privileged.

23 items resolved or mitigated in this branch. 6 non-blocking follow-ups
are tracked in `SECURITY_ANALYSIS.md`.

---

## Critical fixes (production impact today)

### 1. `ProxyFix` registered for Render's reverse proxy
`backend/app.py` — Render terminates TLS one hop upstream, so
`request.remote_addr` previously returned Render's internal proxy IP.
Every rate-limit bucket keyed to the same identifier; every security log
recorded the wrong client IP. `ProxyFix(x_for=1, x_proto=1, x_host=1, x_port=1)`
now runs before CORS init.

### 2. `X-Content-Type-Options` typo corrected
`backend/config.py:168` — the live `SECURITY_HEADERS` dict was shipping
`"nosnif"`. Browsers silently ignore unknown values, so MIME-sniffing
protection was effectively off on every response. Fixed to `"nosniff"`.

### 3. Content-Security-Policy actually shipped
Previously two `SECURITY_HEADERS` dicts existed: a rich one with CSP in
`backend/security_config.py` that was **never imported**, and a minimal
live one in `backend/config.py` with **no CSP**. The orphan file is
deleted; the live dict now ships a strict SPA-appropriate CSP
(no `'unsafe-inline'` on `script-src`, no `'unsafe-eval'`), plus
`Referrer-Policy`, `Permissions-Policy`, and HSTS with `preload`.

### 4. Socket.IO token off the query string
`backend/socketio_events.py` + `frontend/src/services/socket.ts`. Token
is now read from the HttpOnly cookie first, then from the Socket.IO
`auth` payload. Query string is accepted with a deprecation warning for
one release before removal.

### 5. Global Origin/Referer CSRF defense
`backend/app.py` — a new `@before_request` hook rejects state-changing
cookie-authenticated requests whose `Origin`/`Referer` doesn't match the
CORS allow-list. Closes the cross-site form-POST vector that SameSite
cookies alone don't block. Token-based double-submit CSRF is a follow-up.

### 6. `follow-redirects` npm vuln resolved
`frontend/package-lock.json` — `npm audit` now reports 0 vulnerabilities.

---

## Critical fixes (newly introduced by the E2E rebuild)

### 7. `DISABLE_MANDATORY_2FA` production-gated
`backend/routes_auth.py` — the flag only honors truthy values when
`FLASK_ENV` is `testing` or `development`. App startup aborts if the flag
is truthy in production.

### 8. `DISABLE_RATE_LIMIT` production-gated
`backend/utils/rate_limiter.py` — same gate.

### 9. `seed_e2e_test_data.py` production-guarded
Three layers of protection:
- `FLASK_ENV` must be `testing` or `development`.
- `SUPPLYLINE_ALLOW_DESTRUCTIVE_SEED=1` must be explicitly set.
- Resolved `DATABASE_URL` must point at SQLite or localhost.

The seed script and `tests/` directory are also excluded from the
production Docker image via an expanded `backend/.dockerignore`.
`.github/workflows/ci.yml` + `frontend/package.json` updated to export
the required envs for the Playwright pipeline.

---

## High-priority hardening

### 10. JWT `iss` / `aud` claims + strict validation
`backend/auth/jwt_manager.py` — tokens are minted with
`iss="supplyline-mro-suite"` and `aud="supplyline-users"`. Verification
passes `issuer=`, `audience=`, and `options={"require": [...]}` to
`jwt.decode`, hard-failing on missing or mismatched claims.

### 11. Refresh-token revocation
Logout calls `revoke_refresh_jti(jti, exp)`. Decoding a refresh token
checks a TTL-pruned in-process revocation set and rejects matches. Notes
in code that this must move to Redis before horizontal scaling.

### 12. Account-lockout enforcement
`backend/routes_auth.py:login` — after every failed password attempt,
the counter is incremented and compared against
`ACCOUNT_LOCKOUT["MAX_FAILED_ATTEMPTS"]` with progressive backoff up to
`MAX_LOCKOUT_MINUTES`. The UI now sees a 423 `ACCOUNT_LOCKED` response
the moment the lock is applied.

### 13. localStorage token exfil closed
`frontend/src/features/auth/slices/authSlice.ts` plus callers — stops
writing `access_token`/`refresh_token` to localStorage, removes any
pre-existing values on boot, switches `baseApi`, `socket.ts`,
`EditProfileModal`, and `ReportsPage` away from localStorage. The cookie
is now the only persistent auth artifact; XSS can no longer harvest
tokens from `document.storage`.

### 14. `docker-compose.yml admin123` default removed
`docker-compose.yml` — `INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD:?...}`
forces docker-compose to error out instead of shipping `admin123`.
Default `FLASK_ENV` for compose is now `development` so its
`DISABLE_MANDATORY_2FA=true` is honored (it wasn't before the Phase 0
guard).

### 15. `force_password_change` on first admin login
`backend/utils/admin_init.py` — the bootstrapped admin must rotate the
password on first login, regardless of how strong the
`INITIAL_ADMIN_PASSWORD` was.

### 16. Docker base images pinned to a specific version tag
- `backend/Dockerfile`: `python:3.11-slim` → `python:3.11.11-slim`
- `frontend/Dockerfile`: `node:20-alpine` → `node:20.18-alpine`, and
  `nginx:alpine` → `nginx:1.27-alpine`

Digest pinning (`@sha256:...`) is a follow-up for Dependabot.

### 17. Least-privilege GITHUB_TOKEN
`.github/workflows/ci.yml` and `test.yml` now set
`permissions: contents: read` at the workflow level.
`security.yml` already had it.

---

## Medium-priority hardening

### 18. Supabase/Postgres `sslmode=require` enforced
`backend/config.py:validate_security_config` refuses to start in
production if `DATABASE_URL` is a Postgres URL without `sslmode`.
Catches a paste-fumbled direct URL that would otherwise silently run
unencrypted on a platform that lets it.

### 19. Optional Sentry integration
`backend/app.py` + `backend/requirements.in` — `sentry-sdk[flask]==2.20.0`
activates only when `SENTRY_DSN` is set. A `before_send` scrub strips
cookie/Authorization headers and re-applies `sanitize_data()` to request
payloads before events leave the host.

### 20. nginx headers aligned with backend
`frontend/nginx.conf` — `X-Frame-Options` now `DENY` (was `SAMEORIGIN`),
and `Referrer-Policy: strict-origin-when-cross-origin` added.

### 21. `.dockerignore` expanded
Excludes `seed_*.py`, `tests/`, `conftest.py`, `pytest.ini`,
`pyright_results.json`, and the various cache dirs from the production
image.

### 22. `backend/security_config.py` deleted
258 lines of orphan config that no runtime code imported. Kept causing
confusion (`'sel'` typo, `FILE_UPLOAD_CONFIG` with typos like `.gi` and
`.pd`). Consolidated relevant bits into `backend/config.py`.

### 23. CSRF-token generation endpoint noted
`/api/auth/csrf-token` already exists in `routes_auth.py`. The frontend
isn't wired to consume it yet; the token-based double-submit rollout is
a scheduled follow-up that can ride on top of the Origin/Referer guard
shipped in this audit.

---

## Deferred follow-ups

Tracked in `SECURITY_ANALYSIS.md`. Non-blocking for merge of this
branch; none of them represent an exploitable regression against the
audited state:

| # | Follow-up | Why deferred |
|---|---|---|
| A | Token-based double-submit CSRF (route decorators + frontend `X-CSRF-Token`) | Requires coordinated frontend change across ~8 files; Origin/Referer guard closes the practical attack surface |
| B | Remove `access_token`/`refresh_token` from login/refresh JSON body | Frontend already ignores; tracked as "one release after" the localStorage-kill lands |
| C | Redis-backed rate limiting | Deferred by operator on single-instance deployment |
| D | SHA-pin all GitHub Actions | Dependabot-managed; `permissions: contents: read` is the larger supply-chain win and ships in this PR |
| E | Re-enable `frontend-e2e` as a blocking CI check | Explicitly non-blocking during E2E rebuild stabilization; revisit after three green merges |
| F | Digest-pin Docker base images | Version-tag pin shipped; digest pin should ride on Dependabot's weekly cadence |

---

## Reviewer verification steps

### 1. Startup guards work
```bash
# Production + DISABLE_* env → MUST abort
FLASK_ENV=production SECRET_KEY=x JWT_SECRET_KEY=x \
  DISABLE_RATE_LIMIT=true python -c \
  "from config import Config; Config.validate_security_config({'SECRET_KEY':'x','JWT_SECRET_KEY':'x'})"
# Expect RuntimeError
```

### 2. Destructive seed guard works
```bash
# FLASK_ENV unset → refuse
python backend/seed_e2e_test_data.py
# No opt-in env → refuse
FLASK_ENV=testing python backend/seed_e2e_test_data.py
# Both set → runs (only in an empty sqlite test DB)
FLASK_ENV=testing SUPPLYLINE_ALLOW_DESTRUCTIVE_SEED=1 DATABASE_URL=sqlite:///tmp/test.db \
  python backend/seed_e2e_test_data.py
```

### 3. Headers
```bash
curl -I http://localhost:5000/api/health | \
  grep -Ei 'content-security|x-content-type|strict-transport|referrer|permissions-policy'
# Must include CSP, nosniff (not nosnif), HSTS preload, Referrer-Policy, Permissions-Policy
```

### 4. CSRF Origin check
```bash
# Log in first to get cookies, then POST with a forged Origin:
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://supplyline-backend.onrender.com/api/tools \
  -H "Origin: https://evil.example.com" -H "Content-Type: application/json" \
  --cookie "access_token=<real>" -d '{}'
# Expect 403 CSRF_ORIGIN_MISMATCH
```

### 5. WebSocket auth
Open DevTools → Network → WS. The `/socket.io/` handshake URL must NOT
contain `?token=`. The `Cookie` header on the upgrade request carries
`access_token`. Check Render request logs: `grep "token=" | head` should
return zero lines for new connections.

### 6. Production image hygiene
```bash
docker build -f backend/Dockerfile backend/ -t sl-check
docker run --rm sl-check sh -c 'ls /app | grep -E "seed_|^tests$|pytest" && echo "FAIL" || echo "CLEAN"'
# Expect CLEAN
```

### 7. Account lockout end-to-end
Against a test account: submit 5 bad passwords; the 5th response is 423
`ACCOUNT_LOCKED`. A subsequent correct password in the lockout window is
also rejected.

### 8. ProxyFix
After deploy, a log line emitted by any `routes_auth.login` failure
should show a real client IP (from `X-Forwarded-For`), not a Render
`10.x` proxy address.

### 9. `npm audit`
```bash
cd frontend && npm audit --audit-level=moderate
# Expect 0 vulnerabilities
```

### 10. E2E regression
The rebuilt Playwright suite should pass with the new auth/cookie flow.
Specifically: login, logout, password reset, 2FA setup, tool checkout,
file upload, role management, admin user create. No CSP violations in
the browser console.
