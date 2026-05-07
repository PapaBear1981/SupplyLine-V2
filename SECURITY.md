# Security

This document covers reporting vulnerabilities, configuring secrets, the
controls already in place, and the known risks tracked for follow-up.

## Reporting Security Issues

If you discover a security vulnerability, please email the maintainers
directly rather than opening a public issue.

## Required Environment Variables

The application refuses to start without explicit secrets so insecure
defaults are not used in production.

### `SECRET_KEY`

Flask session management and general encryption.

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### `JWT_SECRET_KEY`

JWT signing and verification.

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Set both via shell `export` (Linux/Mac), `$env:` (PowerShell), or `.env`
for Docker.

### Quick Start

```bash
cp .env.example .env
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
docker-compose up -d
```

### Optional: Trusted Device Tokens

After 2FA, users can mark a device as trusted so subsequent logins skip
the TOTP/backup-code step (the password is still required). The token is
stored as a SHA-256 hash in the `trusted_devices` table and sent as the
HttpOnly `trusted_device_token` cookie.

- `TRUSTED_DEVICE_TTL_DAYS` — token lifetime (default `30`; `0` disables).
- `TRUSTED_DEVICE_MAX_PER_USER` — cap per user (default `10`; oldest is
  auto-revoked when exceeded).

Trusted devices are revoked when the user changes their password, an
admin resets it, or the user disables 2FA. Users can manage their own
trusted devices from **Profile → Trusted Devices**.

## Controls In Place

### Authentication and sessions

- Short-lived JWT access tokens (15 min) with 7-day refresh tokens.
- `jti` claim used for CSRF validation; permissions embedded for
  authorization checks.
- Tokens delivered as HttpOnly, Secure, SameSite cookies; cookie-first
  extraction in handlers.
- Password reset tokens are cryptographically strong, hashed in storage,
  and expire after 15 minutes.
- Password reset confirmation is rate-limited per IP and uses
  exponential backoff with token invalidation per account.
- Inactivity auto-logout defaults to 30 minutes, enforced on both the
  backend session validator and the frontend client. Configurable from
  **Admin Dashboard → System Settings → Security Settings**, persisted
  to the database, applied immediately, and recorded in the audit log.

### Network and transport

- CORS origins are explicitly configured; wildcard origins are rejected.
- Security headers include `X-Content-Type-Options`, `X-Frame-Options`,
  `X-XSS-Protection`, and HSTS.

### PII and enumeration

- Login does not log employee numbers for non-existent users; responses
  are generic invalid-credential errors.

### Static analysis (Bandit)

All findings have been addressed:

- **B104 (bind to all interfaces)** — `#nosec` on the intentional Docker
  bind.
- **B113 (requests without timeout)** — 10-second timeout on all
  outbound HTTP calls.
- **B108 (hardcoded `/tmp`)** — replaced with `tempfile.gettempdir()`.

### Dependency scanning

- **Bandit** for Python.
- **npm audit** for JavaScript.
- **GitHub Dependabot** for automated dependency updates.

## Open Risks (Tracked)

Priorities are listed roughly in the order they should be addressed.

### High

1. **CSP missing from runtime headers.** A CSP exists in
   `backend/security_config.py` but uses `'sel'` instead of `'self'` and
   is not wired into the responses produced by `create_app`. Consolidate
   CSP into the runtime headers and verify it is applied.
2. **CSRF enforcement is opt-in.** CSRF token utilities exist for
   JWT-based auth, but enforcement requires the `csrf_required`
   decorator on each state-changing route. Audit cookie-authenticated
   endpoints and apply enforcement where missing.

### Medium

3. **WebSocket auth uses query-string tokens.** Socket.IO expects
   `token` in the query string, which can leak via logs, proxies, and
   browser history. Move to cookie-based auth or a server-side
   handshake.
4. **Rate limiter is in-memory.** Not shared across processes/instances,
   so horizontally scaled deployments lose protection. Use Redis (or
   equivalent) in production.
5. **Account lockout not enforced on login.** `User` has lockout fields
   and helpers, but the login flow does not enforce
   `MAX_FAILED_ATTEMPTS` / `ACCOUNT_LOCKOUT`. Wire these in.

### Low

6. **JWT validation is minimal.** Signature and token type are checked,
   but issuer/audience/clock-skew are not, and refresh tokens cannot be
   revoked. Tighten validation and add revocation on logout/rotation.
7. **Access tokens still returned in the response body.** Login
   responses include access and refresh tokens in JSON for backward
   compatibility. Deprecate or gate behind config.

## Known Vulnerabilities

### `xlsx` (SheetJS) — High severity, no fix available

- **Package:** `xlsx@0.18.5`
- **Advisories:** Prototype Pollution
  (GHSA-4r6h-8v6p-xvw6), ReDoS (GHSA-5pgg-2g8v-p4x9).
- **Usage:** `CalibrationReports.jsx` only — used to **export**
  application-generated data. We never **parse** untrusted Excel files.
- **Mitigation:** Both advisories require importing a malicious file,
  which is not in our threat model.
- **Long-term:** Migrate remaining Excel exports to backend
  `openpyxl@3.1.5` (already used for some reports).

## Best Practices

1. Never commit `.env` files.
2. Use different secrets per environment.
3. Rotate secrets at least every 90 days; invalidate active sessions on
   rotation.
4. In production, use a secrets manager (AWS Secrets Manager, HashiCorp
   Vault, etc.).
5. Limit access to production secrets to authorized personnel.

## Production Deployment Checklist

- [ ] `SECRET_KEY` and `JWT_SECRET_KEY` generated, unique, and strong
- [ ] Secrets stored in a secrets manager, not in version control
- [ ] Different secrets for dev / staging / production
- [ ] Deployment scripts inject secrets at runtime
- [ ] Monitoring configured for authentication failures
- [ ] Incident response plan updated
- [ ] Users notified that re-authentication is required after rotation
