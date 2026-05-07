# Scripts Directory

This directory contains utility scripts for managing the SupplyLine MRO Suite.

## Safe Update Scripts

These scripts safely update the application while preserving your database.

### Linux/Mac

```bash
./safe_update.sh
```

**Note**: On Linux/Mac, you may need to make the script executable first:
```bash
chmod +x safe_update.sh
```

### Windows (PowerShell)

```powershell
.\safe_update.ps1
```

**Note**: If you get an execution policy error, run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## What the Scripts Do

1. ✅ **Create a backup** of your database before making any changes
2. ✅ **Pull latest code** from git repository (if applicable)
3. ✅ **Build new Docker images** with `--no-cache` flag
4. ✅ **Stop containers** without deleting volumes
5. ✅ **Start updated containers** with new code
6. ✅ **Verify health** of backend and frontend services
7. ✅ **Clean up** old Docker images to save disk space

## Features

- **Colorful output** with status indicators
- **Progress tracking** for each step
- **Health checks** to ensure services are running
- **Automatic backup** before any changes
- **Error handling** with helpful messages
- **Rollback information** if something goes wrong

## Output Example

```
╔════════════════════════════════════════════════════════════╗
║     SupplyLine MRO Suite - Safe Update Script             ║
╚════════════════════════════════════════════════════════════╝

[SUCCESS] Docker is running
[INFO] Creating database backup...
[SUCCESS] Database backed up to: ./database/backups/pre_update_20240101_120000.db
[INFO] Building new Docker images...
[INFO] Stopping containers (preserving volumes)...
[INFO] Starting updated containers...
[INFO] Waiting for services to start...
[SUCCESS] Backend is healthy
[SUCCESS] Frontend is healthy
[INFO] Cleaning up old Docker images...

╔════════════════════════════════════════════════════════════╗
║              Update completed successfully!                ║
╚════════════════════════════════════════════════════════════╝

Application URLs:
  Frontend: http://localhost
  Backend:  http://localhost:5000

Backup Location:
  ./database/backups/pre_update_20240101_120000.db
```

## Troubleshooting

### Script Won't Run (Linux/Mac)

**Error**: `Permission denied`

**Solution**:
```bash
chmod +x safe_update.sh
```

### Script Won't Run (Windows)

**Error**: `cannot be loaded because running scripts is disabled`

**Solution** (Run PowerShell as Administrator):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Docker Not Running

**Error**: `Docker is not running`

**Solution**:
- **Windows/Mac**: Start Docker Desktop
- **Linux**: `sudo systemctl start docker`

### Health Check Failed

**Error**: `Backend health check failed after 30 attempts`

**Solution**:
1. Check logs: `docker-compose logs backend`
2. Check if port 5000 is already in use
3. Ensure database file exists and is accessible
4. Try manual restart: `docker-compose restart backend`

### Git Pull Failed

**Warning**: `Git pull failed or no changes to pull`

**This is usually OK** - it means either:
- You're not in a git repository
- There are no new changes to pull
- You have local uncommitted changes

The script will continue with the update.

## Manual Update (Advanced)

If you prefer to run commands manually:

```bash
# 1. Create backup
cp database/tools.db database/backups/manual_$(date +%Y%m%d_%H%M%S).db

# 2. Pull changes (if using git)
git pull

# 3. Build and restart (IMPORTANT: No -v flag!)
docker-compose build --no-cache
docker-compose stop
docker-compose up -d

# 4. Verify health
curl http://localhost:5000/api/health
curl http://localhost:80
```

## Important Notes

### ⚠️ NEVER Use These Commands

```bash
# ❌ This deletes your database!
docker-compose down -v

# ❌ This also deletes volumes!
docker-compose rm -v
```

### ✅ Always Use These Instead

```bash
# ✅ Safe - preserves volumes
docker-compose stop
docker-compose up -d

# ✅ Safe - rebuilds without deleting data
docker-compose up -d --build
```

## Other Scripts

### `set_admin_password.py`

Reset the admin user's password from the command line.

```bash
python scripts/set_admin_password.py <new_password>
# or
ADMIN_PASSWORD=<new_password> python scripts/set_admin_password.py
```

### `verify_e2e_endpoints.py`

Smoke-test all backend endpoints used by the E2E test suite. Useful when
diagnosing E2E failures without running the full Playwright run.

```bash
python scripts/verify_e2e_endpoints.py
```

### `migrate_expendables_to_warehouse.py`

One-off migration to move existing expendable inventory into the
warehouse-scoped tables. Already run on production; kept for reference.

## See Also

- [Database Persistence Guide](../docs/DATABASE_PERSISTENCE.md)
- [Quick Update Guide](../UPDATING.md)
- [Main README](../README.md)

