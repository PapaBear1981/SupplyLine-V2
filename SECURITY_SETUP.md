# Security Setup Guide

## Critical: Environment Variables Configuration

As of the security fixes implemented in issue #410, the application **requires** the following environment variables to be set before it can start. This prevents the use of insecure default values in production.

### Required Environment Variables

#### 1. SECRET_KEY
Used for Flask session management and general encryption.

**Generate a secure key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Set the environment variable:**
- **Linux/Mac:** `export SECRET_KEY="your-generated-key"`
- **Windows (PowerShell):** `$env:SECRET_KEY="your-generated-key"`
- **Docker:** Add to `.env` file or docker-compose environment section

#### 2. JWT_SECRET_KEY
Used for JWT token signing and verification.

**Generate a secure key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Set the environment variable:**
- **Linux/Mac:** `export JWT_SECRET_KEY="your-generated-key"`
- **Windows (PowerShell):** `$env:JWT_SECRET_KEY="your-generated-key"`
- **Docker:** Add to `.env` file or docker-compose environment section

### Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate secrets:**
   ```bash
   # Generate SECRET_KEY
   python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"
   
   # Generate JWT_SECRET_KEY
   python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"
   ```

3. **Update `.env` file** with the generated values

4. **Start the application:**
   ```bash
   # Development
   cd backend
   python app.py
   
   # Production with Docker
   docker-compose up -d
   ```

### Optional: Trusted Device Tokens

Users who complete 2FA can opt to mark a device as trusted so subsequent logins
from that device only require the password. The token is stored as a SHA-256
hash in the `trusted_devices` table and sent to the browser as the HttpOnly
`trusted_device_token` cookie. Passwords are always still required; trusted
devices only skip the TOTP/backup-code step.

Configurable via environment variables (sensible defaults apply):

- `TRUSTED_DEVICE_TTL_DAYS` — lifetime of a trusted-device token (default `30`).
  Set to `0` to disable issuance entirely.
- `TRUSTED_DEVICE_MAX_PER_USER` — cap on concurrent active trusted devices per
  user (default `10`). The oldest active device is auto-revoked when the cap is
  exceeded.

Trusted devices are automatically revoked when: the user changes their own
password, an admin resets their password, or the user disables 2FA. Users can
also list and revoke their trusted devices from **Profile → Trusted Devices**.

Run the migration once after upgrading:

```bash
python backend/migrations/add_trusted_devices.py
```

### Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use different secrets** for development, staging, and production
3. **Rotate secrets regularly** (at least every 90 days)
4. **Use a secrets management service** in production (AWS Secrets Manager, HashiCorp Vault, etc.)
5. **Invalidate all existing sessions** when rotating secrets
6. **Store secrets securely** and limit access to authorized personnel only

### Troubleshooting

**Error: "SECRET_KEY environment variable must be set"**
- Ensure you have set the SECRET_KEY environment variable
- Check that the variable is exported in your current shell session
- For Docker, verify the `.env` file exists and contains the variable

**Error: "JWT_SECRET_KEY environment variable must be set"**
- Ensure you have set the JWT_SECRET_KEY environment variable
- Check that the variable is exported in your current shell session
- For Docker, verify the `.env` file exists and contains the variable

### Migration from Previous Versions

If you're upgrading from a version that used default secrets:

1. **Generate new secrets** as described above
2. **All existing JWT tokens will be invalidated** - users will need to log in again
3. **All existing sessions will be invalidated** - users will need to log in again
4. **Update your deployment scripts** to include the new environment variables
5. **Notify users** about the required re-authentication

### Production Deployment Checklist

- [ ] Generated strong, unique SECRET_KEY
- [ ] Generated strong, unique JWT_SECRET_KEY
- [ ] Secrets are stored in secure secrets management service
- [ ] Secrets are not committed to version control
- [ ] Different secrets used for each environment
- [ ] Deployment scripts updated to inject secrets
- [ ] Monitoring configured for authentication failures
- [ ] Incident response plan updated
- [ ] Users notified about re-authentication requirement

