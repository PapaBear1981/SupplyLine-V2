# SupplyLine V2 - Comprehensive Security Audit Report

**Audit Date:** 2026-02-14
**Application:** SupplyLine MRO Suite v5.3.0
**Auditor:** Security Agent Team

---

## Executive Summary

This comprehensive security audit evaluated the SupplyLine application for production readiness. The application demonstrates **strong foundational security practices** but has **critical issues that must be resolved** before production deployment.

### Overall Security Rating: **C+ (Conditional Pass)**

| Category | Issues Found | Rating |
|----------|--------------|--------|
| Authentication & Authorization | 6 Critical/High | Needs Work |
| Input Validation | 2 Critical, 3 High | Needs Work |
| Secrets Management | 3 Critical | FAIL |
| Dependency Security | 0 Critical | PASS |
| Frontend Security | 1 Critical, 2 High | Needs Work |
| Docker & Deployment | 3 Critical | Needs Work |
| CORS & Headers | 1 High | Needs Work |
| Session Security | 1 Medium | PASS |

---

## Critical Findings Summary

### MUST FIX BEFORE PRODUCTION (8 Critical Issues)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Exposed secrets in .env file** | `.env` | Secrets visible in working directory |
| 2 | **Hardcoded default admin password** | `docker-compose.yml:19` | Default "admin123" password |
| 3 | **Hardcoded fallback encryption key** | `utils/encryption.py:38` | Dev key used if SECRET_KEY missing |
| 4 | **Token logging in console** | `LoginPage.tsx:54` | Setup tokens logged to browser console |
| 5 | **CSP header typo** | `security_config.py` | Uses `'sel'` instead of `'self'` |
| 6 | **Path traversal vulnerability** | `routes_attachments.py:341` | File paths not validated |
| 7 | **Raw SQL queries** | `routes_chemicals.py:45-69` | SQL injection risk |
| 8 | **Admin permission bypass** | `jwt_manager.py:301-333` | Admins bypass all permission checks |

---

## Detailed Findings by Category

### 1. Authentication & Authorization

#### Critical Issues

**A. Admin Permission Bypass (CRITICAL)**
- **Location:** `backend/auth/jwt_manager.py:301-333`
- **Issue:** Admins automatically bypass ALL permission checks
- **Risk:** Compromised admin = full system compromise
- **Fix:** Implement granular admin permissions

**B. Broken Backup Code Login (HIGH)**
- **Location:** `routes_totp.py:636-644`
- **Issue:** References non-existent JWT methods
- **Risk:** 2FA backup recovery fails at runtime
- **Fix:** Use `JWTManager.generate_tokens()` instead

**C. IDOR in Permission Management (HIGH)**
- **Location:** `routes_permissions.py:62-175`
- **Issue:** No scope validation for user permission changes
- **Risk:** Users can modify permissions outside their scope
- **Fix:** Add department/hierarchy validation

#### Strengths
- JWT-based authentication properly implemented
- Account lockout mechanism (5 attempts, exponential backoff)
- TOTP 2FA support with backup codes
- Password policy enforcement (8+ chars, complexity requirements)
- 90-day password expiry

---

### 2. Input Validation & Injection Prevention

#### Critical Issues

**A. Path Traversal (CRITICAL)**
- **Location:** `routes_attachments.py:341, 184-185`
- **Issue:** File paths from database not validated
- **Risk:** Read arbitrary files via malicious database entries
- **Fix:** Use `os.path.realpath()` with directory validation

**B. Raw SQL Queries (CRITICAL)**
- **Location:** `routes_chemicals.py:45-47, 68-69`
- **Issue:** `text()` queries without parameterization
- **Risk:** SQL injection if expanded to use user input
- **Fix:** Convert to SQLAlchemy ORM expressions

**C. CSRF Protection Underutilized (HIGH)**
- **Location:** Routes throughout backend
- **Issue:** `@csrf_required` decorator not widely applied
- **Risk:** State-changing requests vulnerable to CSRF
- **Fix:** Apply decorator to all POST/PUT/DELETE endpoints

#### Strengths
- Comprehensive input validation patterns
- XSS and SQL injection detection in middleware
- HTML entity encoding for output

---

### 3. Secrets Management

#### Critical Issues

**A. Exposed Secrets (CRITICAL)**
- **Location:** `.env` file in working directory
- **Issue:** Contains actual SECRET_KEY and JWT_SECRET_KEY
- **Impact:** Anyone with repo access can read secrets
- **Fix:** Rotate secrets immediately, use external secrets manager

**B. Hardcoded Default Password (CRITICAL)**
- **Location:** `docker-compose.yml:19`
- **Issue:** `INITIAL_ADMIN_PASSWORD:-admin123`
- **Impact:** Default password if env var not set
- **Fix:** Remove default, require explicit setting

**C. Fallback Encryption Key (CRITICAL)**
- **Location:** `utils/encryption.py:38`
- **Issue:** Uses `"dev-secret-key-CHANGE-IN-PRODUCTION"` fallback
- **Impact:** TOTP secrets encrypted with known key
- **Fix:** Fail fast if ENCRYPTION_KEY not set

**D. Hardcoded Passwords in Scripts (HIGH)**
- **Locations:**
  - `set_admin_password.py:42` - `"Caden1234!"`
  - `conftest.py:159,176,193` - Test passwords
  - `seed_e2e_test_data.py` - Multiple defaults
- **Impact:** Known passwords in repository
- **Fix:** Remove scripts, use environment variables

#### Strengths
- `.env` properly in `.gitignore`
- `.env.example` has placeholder values
- Secret rotation documented

---

### 4. Dependency Security

#### Status: PASS

- All Python packages at secure versions
- Flask 3.1.1 (CVE-2025-47278 patched)
- Werkzeug 3.1.3 (CVE-2023-25577, CVE-2023-46136 patched)
- Flask-CORS 6.0.0 (CVE-2024-6839, CVE-2024-6844, CVE-2024-6866 patched)
- npm packages current, no critical vulnerabilities
- Trivy scanning configured in CI/CD
- Bandit security scanning enabled

#### Known Accepted Vulnerabilities
- openpyxl CVE-2023-30533, CVE-2024-22363 (export-only usage)
- Documented in `.trivyignore` and `SECURITY_NOTES.md`

---

### 5. Frontend Security

#### Critical Issues

**A. Token Logging (CRITICAL)**
- **Location:** `LoginPage.tsx:54`
- **Issue:** `console.log('[LoginPage] setup_token:', response.setup_token);`
- **Impact:** Tokens visible in browser console/logs
- **Fix:** Remove all console.log statements with tokens

**B. Tokens in localStorage (HIGH)**
- **Locations:** `baseApi.ts`, `authSlice.ts`, `socket.ts`
- **Issue:** JWT stored in localStorage (XSS vulnerable)
- **Impact:** Any XSS can steal authentication tokens
- **Fix:** Migrate to httpOnly cookies

**C. WebSocket Token in Query String (MEDIUM)**
- **Location:** `socket.ts:20-31`
- **Issue:** Token passed as query parameter
- **Impact:** Token visible in logs, browser history
- **Fix:** Use socket authentication events

#### Strengths
- No `dangerouslySetInnerHTML` usage
- No `eval()` or dynamic code execution
- Ant Design forms with built-in validation
- TypeScript strict mode enabled

---

### 6. Docker & Deployment Security

#### Critical Issues

**A. No TLS/HTTPS (CRITICAL)**
- **Location:** `docker-compose.yml:49`
- **Issue:** Frontend exposes HTTP-only port
- **Impact:** All traffic unencrypted
- **Fix:** Add reverse proxy with TLS (Traefik/nginx-proxy)

**B. Default Admin Password (CRITICAL)**
- See Secrets Management section

**C. Overly Permissive CORS (HIGH)**
- **Location:** `docker-compose.yml:21`
- **Issue:** Includes `localhost:80` in CORS origins
- **Impact:** May bypass security in some deployments
- **Fix:** Set production domains only

#### Strengths
- Non-root users in containers
- Resource limits configured
- Health checks implemented
- Multi-stage Docker builds
- Trivy vulnerability scanning in CI/CD

---

### 7. CORS, Headers & Session Security

#### High Issues

**A. CSP Header Typo (HIGH)**
- **Location:** `security_config.py`
- **Issue:** Uses `'sel'` instead of `'self'`
- **Impact:** CSP effectively disabled
- **Fix:** Replace all `'sel'` with `'self'`

**B. Rate Limiting Not Applied to Auth (HIGH)**
- **Location:** `routes_auth.py`
- **Issue:** Login/refresh endpoints not rate limited
- **Impact:** Brute force attacks possible
- **Fix:** Apply `@rate_limit` to auth endpoints

#### Strengths
- Security headers properly configured (X-Frame-Options, HSTS, etc.)
- HttpOnly, Secure, SameSite cookies
- CORS rejects wildcard origins
- Account lockout mechanism

---

## Remediation Roadmap

### Phase 1: CRITICAL (Before Any Production Deployment)

**Week 1 - Immediate Actions:**

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Rotate exposed SECRET_KEY and JWT_SECRET_KEY | P0 | 1h | DevOps |
| Remove default admin password from docker-compose | P0 | 30m | DevOps |
| Remove fallback encryption key, fail fast | P0 | 1h | Backend |
| Remove console.log with tokens in LoginPage | P0 | 30m | Frontend |
| Fix CSP `'sel'` -> `'self'` typo | P0 | 30m | Backend |
| Fix path traversal in attachments | P0 | 2h | Backend |
| Convert raw SQL to ORM queries | P0 | 2h | Backend |
| Fix broken backup code JWT methods | P0 | 1h | Backend |

### Phase 2: HIGH (Before Beta/Pilot Users)

**Weeks 2-3:**

| Task | Priority | Effort |
|------|----------|--------|
| Implement TLS/HTTPS with reverse proxy | P1 | 4h |
| Add rate limiting to auth endpoints | P1 | 2h |
| Apply CSRF decorator to all state-changing routes | P1 | 3h |
| Migrate tokens from localStorage to httpOnly cookies | P1 | 4h |
| Add department scope validation to permissions | P1 | 3h |
| Implement granular admin permissions | P1 | 4h |
| Remove hardcoded passwords from all scripts | P1 | 2h |

### Phase 3: MEDIUM (Before General Availability)

**Weeks 4-6:**

| Task | Priority | Effort |
|------|----------|--------|
| Implement server-side token revocation | P2 | 4h |
| Add Content-Security-Policy reporting | P2 | 2h |
| Implement email delivery for password resets | P2 | 4h |
| Separate password/TOTP failure counters | P2 | 2h |
| Increase backup code entropy | P2 | 1h |
| Add SBOM generation to CI/CD | P2 | 2h |
| Implement secrets management (Vault/KMS) | P2 | 8h |

---

## Pre-Deployment Checklist

### Infrastructure
- [ ] Generate new SECRET_KEY (64+ bytes)
- [ ] Generate new JWT_SECRET_KEY (64+ bytes)
- [ ] Set up secrets management (AWS Secrets Manager, Vault, etc.)
- [ ] Configure TLS certificates
- [ ] Set up reverse proxy (Traefik, nginx-proxy)
- [ ] Configure production CORS origins
- [ ] Enable SESSION_COOKIE_SECURE=True
- [ ] Set FLASK_ENV=production

### Application
- [ ] Remove all console.log statements with sensitive data
- [ ] Remove default passwords from docker-compose
- [ ] Apply rate limiting to auth endpoints
- [ ] Apply CSRF protection to all routes
- [ ] Fix CSP header configuration
- [ ] Test all 2FA flows including backup codes
- [ ] Verify account lockout works correctly

### Testing
- [ ] Run full security test suite
- [ ] Run Bandit security scan (no critical/high)
- [ ] Run npm audit (no critical)
- [ ] Run Trivy container scan
- [ ] Test password reset flow
- [ ] Test account lockout and recovery
- [ ] Penetration testing (recommended)

### Monitoring
- [ ] Set up security event logging
- [ ] Configure alerting for failed login attempts
- [ ] Configure alerting for rate limit violations
- [ ] Set up log aggregation (ELK, Splunk, CloudWatch)
- [ ] Document incident response procedures

---

## Conclusion

SupplyLine has a **solid security foundation** with modern authentication, input validation, and security headers. However, **8 critical issues must be resolved** before production deployment, primarily around secrets management and authentication security.

**Estimated effort for Phase 1 (Critical fixes):** 10-12 hours
**Estimated effort for Phase 2 (High fixes):** 20-25 hours
**Total time to production-ready:** 2-3 weeks with focused effort

The application can be production-ready once critical issues are addressed. The existing CI/CD security pipeline (Bandit, Trivy, npm audit) provides good ongoing protection.

---

## Appendix: File Locations of Issues

### Critical Files Requiring Changes

| File | Line(s) | Issue |
|------|---------|-------|
| `docker-compose.yml` | 19 | Default admin password |
| `utils/encryption.py` | 38 | Fallback dev key |
| `security_config.py` | CSP section | `'sel'` typo |
| `routes_attachments.py` | 184-185, 341 | Path traversal |
| `routes_chemicals.py` | 45-47, 68-69 | Raw SQL |
| `auth/jwt_manager.py` | 301-333 | Admin bypass |
| `routes_totp.py` | 636-644 | Broken JWT methods |
| `frontend/src/features/auth/pages/LoginPage.tsx` | 54 | Token logging |
| `frontend/src/services/baseApi.ts` | 16, 26 | localStorage tokens |
| `frontend/src/features/auth/slices/authSlice.ts` | 29, 36 | localStorage tokens |

---

*Report generated by SupplyLine Security Agent Team*
