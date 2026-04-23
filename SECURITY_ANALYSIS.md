# Security Analysis (SupplyLine V2)

> **Updated 2026-04-22** — most gaps enumerated in the previous revision
> were resolved in the production security audit (see
> `SECURITY_AUDIT_2026-04.md`). Status annotations below reflect the
> post-audit state.

## Scope reviewed
- Backend configuration, security headers, and CORS controls.
- JWT authentication, cookie handling, and CSRF utilities.
- Password reset and account lockout flows.
- Rate limiting implementation.
- WebSocket authentication handling.
- Documented dependency vulnerabilities.

## Strengths / existing controls

### Secrets management
- Environment variables for `SECRET_KEY` and `JWT_SECRET_KEY` are required, with guidance on generation and rotation.
- Default secrets are avoided in non-testing environments.
- Render auto-generates both via `generateValue: true` (see `render.yaml`).
- Startup validator (`Config.validate_security_config`) fails fast if any
  `DISABLE_*` test-mode env var leaks into production.

### Authentication and session security
- JWT access tokens are short-lived (15–30 minutes) with 7-day refresh tokens.
- Tokens include `iss`, `aud`, and `jti` claims; all claims are verified on decode.
- HttpOnly, Secure, SameSite cookies are used for token storage; cookie-first extraction is preferred.
- Access and refresh tokens are no longer persisted to `localStorage` — XSS cannot exfiltrate them via `document.storage`.
- Refresh-token revocation list invalidates a `jti` on explicit logout.
- Account lockout is enforced with progressive backoff based on `ACCOUNT_LOCKOUT` config.
- Initial admin account ships with `force_password_change=True`.

### CORS and security headers
- CORS origins are explicitly configured and wildcard origins are rejected.
- Runtime `SECURITY_HEADERS` now include a full CSP, `Referrer-Policy`,
  `Permissions-Policy`, HSTS with `preload`, and the correctly-spelled
  `X-Content-Type-Options: nosniff`.
- `ProxyFix` is registered so `request.remote_addr` reflects the real client
  behind Render's reverse proxy.

### CSRF defense
- Global Origin/Referer validation on state-changing cookie-authenticated
  requests. Token-based double-submit (via the existing `@csrf_required`
  decorator + `/api/auth/csrf-token` endpoint) is a follow-up.

### PII protection and user enumeration
- Login flow avoids logging employee numbers for non-existent users and returns generic invalid-credential responses.

### Documented dependency risk
- The `xlsx` frontend dependency vulnerability is tracked with explicit mitigations and recommendations.
- `follow-redirects` moderate vuln resolved via `npm audit fix`.

## Risk areas / gaps (post-audit status)

### 1) CSP configuration — **RESOLVED**
Runtime `SECURITY_HEADERS` now ships a strict CSP (no `unsafe-inline` on
`script-src`, no `unsafe-eval`). The orphan `backend/security_config.py`
with the `'sel'` typo has been deleted.

### 2) CSRF enforcement — **PARTIALLY RESOLVED**
Global Origin/Referer check closes the cross-site form-POST vector.
Token-based double-submit CSRF remains deferred: the `@csrf_required`
decorator is defined but not yet applied to routes, and the frontend
does not yet fetch/send `X-CSRF-Token`. See audit follow-ups.

### 3) WebSocket authentication — **RESOLVED**
Token is read from the HttpOnly cookie first, then from the Socket.IO
`auth` payload. Legacy query-string path logs a deprecation warning and
will be removed in a follow-up release.

### 4) Rate limiting is in-memory only — **ACCEPTED**
Deferred by deploy-architecture choice: Render runs a single backend
instance. In-memory rate limiting is sufficient while that holds. Before
horizontal scaling, swap to a Redis-backed limiter (Render Key-Value or
Upstash).

### 5) Account lockout — **RESOLVED**
`routes_auth.login` now enforces `ACCOUNT_LOCKOUT["MAX_FAILED_ATTEMPTS"]`
and applies progressive backoff up to `MAX_LOCKOUT_MINUTES`.

### 6) JWT lifecycle controls — **RESOLVED**
`iss`/`aud` claims added and verified on decode; required-claim check
rejects tokens missing `exp`, `iat`, `iss`, or `aud`. Refresh-token `jti`
is revoked on logout.

### 7) Access token in response body — **MITIGATED**
Frontend no longer reads or persists `access_token` from the response
body or `localStorage`. Cookie is authoritative. Backend still returns
`access_token` in JSON for backward compatibility with older clients;
scheduled for removal in a follow-up once no clients depend on it.

### 8) Test-mode escape hatches — **RESOLVED** (new in this audit)
`DISABLE_MANDATORY_2FA`, `DISABLE_RATE_LIMIT`, and the destructive
`seed_e2e_test_data.py` all now require `FLASK_ENV` to be
testing/development, fail-fast on production, and the seed script
additionally requires `SUPPLYLINE_ALLOW_DESTRUCTIVE_SEED=1` and rejects
non-local `DATABASE_URL`. Seed scripts and `tests/` are excluded from
the production Docker image via `.dockerignore`.

## Deferred follow-ups (non-blocking)

- Token-based double-submit CSRF (frontend + route decorators).
- Remove `access_token`/`refresh_token` from login/refresh JSON response bodies.
- Redis-backed rate limiting when scaling past a single Render instance.
- SHA-pin third-party GitHub Actions via Dependabot.
- Re-enable `frontend-e2e` as a blocking CI check once three consecutive
  green runs confirm the rebuilt suite is stable.
- Replace the temporary base-image tag pins with digest pins (`@sha256:…`).
