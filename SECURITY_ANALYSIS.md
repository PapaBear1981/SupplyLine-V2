# Security Analysis (SupplyLine V2)

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

### Authentication and session security
- JWT access tokens are short-lived (15 minutes) with 7-day refresh tokens.
- Tokens are issued with `jti` for CSRF validation and include permissions for authorization checks.
- HttpOnly, Secure, SameSite cookies are used for token storage; cookie-first extraction is preferred.
- Password reset tokens are cryptographically strong, hashed in storage, and expire after 15 minutes.
- Password reset confirmation is protected by IP rate limiting and account-level exponential backoff with token invalidation.

### CORS and security headers
- CORS origins are explicitly configured and wildcard origins are rejected.
- Security headers include `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and HSTS.

### PII protection and user enumeration
- Login flow avoids logging employee numbers for non-existent users and returns generic invalid-credential responses.

### Documented dependency risk
- The `xlsx` frontend dependency vulnerability is tracked with explicit mitigations and recommendations.

## Risk areas / gaps

### 1) CSP configuration is inconsistent/missing
- The runtime `SECURITY_HEADERS` used in the app do not include a Content Security Policy (CSP).
- A CSP exists in `backend/security_config.py`, but it uses `'sel'` instead of `'self'` and does not appear wired into the runtime config.

**Recommended follow-up**: Consolidate CSP into the runtime security headers, fix `'self'` directives, and verify it is applied in `create_app` responses.

### 2) CSRF enforcement is optional
- CSRF token generation/validation exists for JWT-based auth, but enforcement relies on explicitly applying the `csrf_required` decorator to state-changing routes.

**Recommended follow-up**: Audit state-changing endpoints and enforce CSRF where cookie-based auth is used.

### 3) WebSocket authentication uses query-string tokens
- Socket.IO auth expects `token` in query parameters, which can leak through logs, proxies, and browser history.

**Recommended follow-up**: Prefer cookie-based auth or a server-side auth handshake that avoids query-string tokens.

### 4) Rate limiting is in-memory only
- The rate limiter is in-memory and not shared across processes/instances, which weakens protection in horizontally scaled deployments.

**Recommended follow-up**: Use Redis (or equivalent) for distributed rate limiting in production.

### 5) Account lockout policy not fully enforced
- `User` supports lockout fields and helpers, but the login flow does not appear to enforce lockout based on a failed-attempt threshold.

**Recommended follow-up**: Enforce `MAX_FAILED_ATTEMPTS` and apply lockouts based on `ACCOUNT_LOCKOUT` settings.

### 6) JWT lifecycle controls are minimal
- JWT verification checks signature and token type, but issuer/audience/clock-skew checks are not enforced, and there is no revocation mechanism for refresh tokens.

**Recommended follow-up**: Enforce issuer/audience where applicable and consider refresh-token revocation on logout or rotation.

### 7) Access token is still returned in response body
- Login responses include access and refresh tokens in JSON for backward compatibility.

**Recommended follow-up**: Deprecate token-in-body or provide a config flag to disable JSON token exposure.

## Suggested priorities

1. **High**: Add/validate CSP in runtime security headers.
2. **High**: Ensure CSRF protection for cookie-authenticated state-changing endpoints.
3. **Medium**: Replace query-string WebSocket auth with a safer mechanism.
4. **Medium**: Implement distributed rate limiting for production.
5. **Medium**: Enforce account lockout threshold and policy settings.
6. **Low/Medium**: Expand JWT validation (issuer/audience) and add refresh token revocation.
7. **Low**: Remove tokens from response body or gate behind configuration.
