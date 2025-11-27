# Docker Deployment Guide

**Date:** November 27, 2025
**Status:** ✅ Ready for Docker Deployment

---

## 🐳 Overview

This application uses Docker Compose to orchestrate two services:
- **Backend:** Flask API (Python)
- **Frontend:** React + Ant Design (served by nginx)

---

## 📋 Prerequisites

- Docker Desktop installed (Windows/Mac) or Docker Engine + Docker Compose (Linux)
- At least 2GB of free RAM
- Ports 80 (frontend) and 5000 (backend) available

---

## 🚀 Quick Start

### 1. Clone and Navigate
```bash
cd SupplyLine-MRO-Suite-newFrontend
```

### 2. Create Environment File
```bash
cp .env.example .env
```

Edit `.env` and set these required variables:
```bash
# Security Keys (REQUIRED - generate unique values)
SECRET_KEY=your-secret-key-here-min-32-chars
JWT_SECRET_KEY=your-jwt-secret-key-here-min-32-chars

# Environment
FLASK_ENV=production
FLASK_DEBUG=False

# Ports (optional - defaults shown)
FRONTEND_PORT=80
BACKEND_PORT=5000

# CORS (already configured for Docker network)
CORS_ORIGINS=http://localhost,http://localhost:80
```

**Generate Secure Keys:**
```bash
# Python method
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Or use online generator
# https://www.random.org/strings/
```

### 3. Build and Start
```bash
docker-compose up --build -d
```

### 4. Access the Application
- **Frontend:** http://localhost
- **Backend API:** http://localhost:5000/api/health

### 5. Login
- Employee Number: `ADMIN001`
- Password: `admin123`

**⚠️ IMPORTANT: Change default credentials immediately in production!**

---

## 📦 Docker Architecture

### Services

#### Frontend Service
- **Image:** Custom nginx + React build
- **Port:** 80 (configurable via FRONTEND_PORT)
- **Resources:**
  - CPU Limit: 0.25 cores
  - Memory Limit: 256MB
- **Features:**
  - Nginx serves static React build
  - API proxy to backend (/api → backend:5000)
  - Socket.IO proxy (/socket.io → backend:5000)
  - Gzip compression enabled
  - Health check endpoint at /health

#### Backend Service
- **Image:** Python Flask application
- **Port:** 5000 (configurable via BACKEND_PORT)
- **Resources:**
  - CPU Limit: 0.5 cores
  - Memory Limit: 512MB
- **Volumes:**
  - `database` - SQLite database persistence
  - `flask_session` - Session storage
  - `static_uploads` - User uploads, avatars, calibration certificates
- **Features:**
  - Auto-restart on failure
  - Health check endpoint at /api/health

### Network
- **Name:** `supplyline-network`
- **Type:** Bridge network
- **Purpose:** Allows frontend and backend to communicate internally

### Volumes
- **database:** Persists SQLite database
- **flask_session:** Persists user sessions
- **static_uploads:** Persists uploaded files

---

## 🔧 Docker Commands

### Start Services
```bash
# Start in detached mode (background)
docker-compose up -d

# Start with build (after code changes)
docker-compose up --build -d

# Start in foreground (see logs)
docker-compose up
```

### Stop Services
```bash
# Stop containers (keep data)
docker-compose stop

# Stop and remove containers (keep volumes)
docker-compose down

# Stop and remove everything including volumes (⚠️ DATA LOSS)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 frontend
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart frontend
docker-compose restart backend
```

### Check Status
```bash
# Service status
docker-compose ps

# Health checks
docker-compose ps --format json | jq
```

### Execute Commands
```bash
# Backend shell
docker-compose exec backend sh

# Frontend shell
docker-compose exec frontend sh

# Run Flask commands
docker-compose exec backend flask --help
```

---

## 🔍 Health Checks

Both services have health checks configured:

### Frontend Health Check
```bash
curl http://localhost/health
# Response: healthy
```

### Backend Health Check
```bash
curl http://localhost:5000/api/health
# Response: {"status": "healthy"}
```

### Docker Health Status
```bash
docker-compose ps
# Shows "healthy" status for both services
```

---

## 🗄️ Database Management

### Backup Database
```bash
# Copy database out of container
docker cp supplyline-mro-backend:/database/tools.db ./backup-$(date +%Y%m%d).db

# Or use volume directly
docker run --rm -v supplyline-database:/data -v $(pwd):/backup alpine tar czf /backup/database-backup.tar.gz /data
```

### Restore Database
```bash
# Copy database into container
docker cp ./backup.db supplyline-mro-backend:/database/tools.db

# Restart backend
docker-compose restart backend
```

### Reset Database
```bash
# ⚠️ This will delete all data!
docker-compose down -v
docker-compose up -d
```

---

## 🔄 Updates and Maintenance

### Update Application Code
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build -d

# View logs to confirm
docker-compose logs -f
```

### Update Dependencies
```bash
# Frontend
cd frontend
npm install
cd ..

# Backend
cd backend
pip install -r requirements.txt
cd ..

# Rebuild
docker-compose build
docker-compose up -d
```

### Clean Up Old Images
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
```

---

## 📊 Resource Monitoring

### View Resource Usage
```bash
docker stats supplyline-mro-frontend supplyline-mro-backend
```

### Adjust Resource Limits
Edit `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'      # Increase CPU
      memory: 1024M    # Increase memory
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Frontend Not Accessible
```bash
# Check if container is running
docker-compose ps frontend

# Check logs
docker-compose logs frontend

# Verify nginx config
docker-compose exec frontend nginx -t

# Restart
docker-compose restart frontend
```

### Backend Not Responding
```bash
# Check logs
docker-compose logs backend

# Check health
curl http://localhost:5000/api/health

# Restart
docker-compose restart backend
```

### Database Connection Issues
```bash
# Check if volume exists
docker volume ls | grep supplyline-database

# Inspect volume
docker volume inspect supplyline-database

# Check backend logs for errors
docker-compose logs backend | grep -i database
```

### Port Already in Use
```bash
# Find what's using port 80
netstat -ano | findstr :80   # Windows
lsof -i :80                  # Linux/Mac

# Change port in .env
FRONTEND_PORT=8080

# Restart
docker-compose down
docker-compose up -d
```

### Cannot Connect to Backend from Frontend
```bash
# Check network
docker network inspect supplyline-network

# Verify both services are on same network
docker-compose ps

# Check nginx proxy config
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

---

## 🔒 Security Considerations

### Production Checklist
- [ ] Change default admin credentials
- [ ] Set strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Use HTTPS with reverse proxy (nginx/traefik)
- [ ] Enable firewall rules
- [ ] Regular security updates
- [ ] Database backups
- [ ] Monitor logs for suspicious activity
- [ ] Set SESSION_COOKIE_SECURE=True (with HTTPS)

### Environment Variables
Never commit `.env` to version control:
```bash
# .gitignore already includes:
.env
.env.local
.env.production
```

---

## 🌐 Production Deployment

### Using a Reverse Proxy (Recommended)

**Example with Traefik:**
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`supplyline.example.com`)"
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

### Environment-Specific Configs
```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale backend (requires load balancer)
docker-compose up -d --scale backend=3
```

### Vertical Scaling
Increase resources in `docker-compose.yml` as shown in Resource Monitoring section.

---

## 🧪 Testing

### Run Tests in Container
```bash
# Backend tests
docker-compose exec backend pytest

# Frontend tests (if configured)
docker-compose exec frontend npm test
```

---

## 📝 Logs and Debugging

### Log Locations
- Frontend logs: `docker-compose logs frontend`
- Backend logs: `docker-compose logs backend`
- Nginx access log: Inside frontend container at `/var/log/nginx/access.log`
- Nginx error log: Inside frontend container at `/var/log/nginx/error.log`

### Debug Mode
```bash
# Enable Flask debug mode (development only!)
# Edit .env:
FLASK_DEBUG=True

# Rebuild and restart
docker-compose up --build -d
```

---

## 🔗 Useful Links

- Docker Compose Reference: https://docs.docker.com/compose/
- Nginx Documentation: https://nginx.org/en/docs/
- Flask Deployment: https://flask.palletsprojects.com/en/latest/deploying/

---

## 📋 Quick Reference

### One-Line Commands
```bash
# Fresh start
docker-compose down -v && docker-compose up --build -d

# View all logs
docker-compose logs -f

# Rebuild frontend only
docker-compose build frontend && docker-compose up -d frontend

# Backup database
docker cp supplyline-mro-backend:/database/tools.db ./backup.db

# Check health
curl -f http://localhost/health && curl -f http://localhost:5000/api/health && echo "All healthy!"
```

---

## 🎯 Next Steps

1. ✅ Build and test locally with Docker
2. Set up CI/CD pipeline (GitHub Actions)
3. Deploy to production server
4. Set up monitoring (Prometheus/Grafana)
5. Configure automated backups
6. Set up SSL/TLS certificates
7. Implement log aggregation (ELK stack)

---

**Docker deployment is now ready! Your application can run anywhere Docker runs.** 🐳
