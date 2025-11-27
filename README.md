# SupplyLine MRO Suite - Backend API

A comprehensive, secure, and scalable backend API for Maintenance, Repair, and Operations (MRO) management built with Flask, JWT authentication, and Socket.IO for real-time features.

**Current Version: 5.3.0**

## Overview

This repository contains the **backend API only**. The frontend has been removed to allow you to integrate any modern frontend framework of your choice (React, Vue, Angular, Svelte, etc.).

The backend provides a complete REST API with JWT authentication for managing:
- Tool inventory and calibration
- Chemical inventory and analytics
- Mobile warehouse kits
- User management and RBAC
- Barcode/QR code generation
- Real-time messaging
- Reporting and analytics

## Quick Start

### Prerequisites
- Python 3.11+
- pip (Python package manager)
- Docker and Docker Compose (optional, for containerized deployment)

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd SupplyLine-MRO-Suite-newFrontend
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

3. **Generate secure keys** (REQUIRED):
   ```bash
   python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
   python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))" >> .env
   ```

4. **Configure CORS** for your frontend:
   Edit `.env` and update `CORS_ORIGINS` with your frontend URL:
   ```
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
   ```

5. **Start the backend**:

   **Option A: Using the startup script** (Windows/Linux/macOS):
   ```bash
   # Windows
   start_dev_servers.bat

   # Linux/macOS
   ./start_dev_servers.sh
   ```

   **Option B: Manual setup**:
   ```bash
   cd backend
   python -m venv venv

   # Activate virtual environment
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate

   pip install -r requirements.txt
   python app.py
   ```

6. **Verify the backend is running**:
   ```bash
   curl http://localhost:5000/api/health
   ```

### Docker Deployment

```bash
# Build and start the backend container
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop the backend
docker-compose down
```

## API Documentation

See [BACKEND_API.md](BACKEND_API.md) for comprehensive API documentation including:
- Available endpoints and modules
- Authentication flow
- Request/response formats
- Environment variables
- Security features

## Setting Up a New Frontend

### Step 1: Create Your Frontend Project

Choose your preferred framework and create a new project:

**React (Vite)**:
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

**Vue**:
```bash
npm create vue@latest frontend
cd frontend
npm install
```

**Angular**:
```bash
ng new frontend
cd frontend
```

**Next.js**:
```bash
npx create-next-app@latest frontend
cd frontend
```

### Step 2: Configure API Client

Create an API client to communicate with the backend:

**Example for React/Vue (Axios)**:

```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Step 3: Implement Authentication

**Login example**:

```javascript
import api from './api';

async function login(employeeNumber, password) {
  try {
    const response = await api.post('/api/auth/login', {
      employee_number: employeeNumber,
      password: password,
    });

    const { access_token, user } = response.data;
    localStorage.setItem('access_token', access_token);
    return user;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}
```

### Step 4: Update CORS Configuration

Add your frontend URL to the backend's CORS configuration in `.env`:

```
CORS_ORIGINS=http://localhost:3000
```

Restart the backend for changes to take effect.

### Step 5: Start Development

```bash
# Terminal 1: Backend (already running)
cd backend
python app.py

# Terminal 2: Frontend
cd frontend
npm run dev
```

## Default Users

The system includes default users for testing:

- **Admin**: Employee Number `ADMIN001`, Password `admin123`
- **Materials**: Employee Number `MAT001`, Password `materials123`
- **Maintenance**: Employee Number `MAINT001`, Password `maintenance123`

**⚠️ Change these credentials in production!**

## Key Features

### Backend API Modules

- **Authentication & Authorization**: JWT-based auth, RBAC, password reset
- **Tool Management**: Inventory, calibration, barcode scanning
- **Chemical Management**: Inventory, analytics, waste tracking
- **Kit Management**: Mobile warehouse, transfers, messaging, reorders
- **Warehouse Management**: Location tracking, inventory operations
- **Reporting & Analytics**: Comprehensive reports for tools, chemicals, usage
- **Barcode System**: PDF label generation for tools, chemicals, expendables
- **Messaging**: Real-time communication via Socket.IO
- **Bulk Operations**: Import/export functionality

### Security Features

- JWT token-based authentication
- CSRF protection
- Rate limiting and account lockout
- Secure password hashing
- Role-based access control (RBAC)
- SQL injection protection via SQLAlchemy ORM

### Database Support

- **SQLite** (default): Data stored in `database/tools.db`
- **PostgreSQL**: Set `DATABASE_URL` environment variable

## Environment Variables

Key environment variables (see `.env.example` for full list):

### Required
- `SECRET_KEY` - Flask secret key
- `JWT_SECRET_KEY` - JWT signing key

### Optional
- `FLASK_ENV` - Environment (development/production)
- `FLASK_DEBUG` - Debug mode (True/False)
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `DATABASE_URL` - PostgreSQL connection string
- `PUBLIC_URL` - Public URL for QR codes

## Project Structure

```
SupplyLine-MRO-Suite-newFrontend/
├── backend/                    # Flask backend API
│   ├── app.py                  # Application entry point
│   ├── config.py               # Configuration
│   ├── models.py               # Database models
│   ├── routes_*.py             # API route modules
│   ├── requirements.txt        # Python dependencies
│   └── ...
├── database/                   # SQLite database
│   └── tools.db               # Main database file
├── .env.example               # Environment variables template
├── docker-compose.yml         # Docker configuration
├── BACKEND_API.md             # API documentation
└── README.md                  # This file
```

## API Health Check

Test the backend is running:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T10:30:00Z"
}
```

## WebSocket/Socket.IO

The backend includes Socket.IO support for real-time features:

**Client connection example**:
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('access_token')
  }
});

socket.on('connect', () => {
  console.log('Connected to backend');
});
```

## Deployment

### Production Checklist

1. ✅ Generate strong, unique `SECRET_KEY` and `JWT_SECRET_KEY`
2. ✅ Set `FLASK_ENV=production` and `FLASK_DEBUG=False`
3. ✅ Configure appropriate `CORS_ORIGINS` for your domain
4. ✅ Use PostgreSQL for production database
5. ✅ Set up SSL/TLS with reverse proxy (Nginx, Traefik)
6. ✅ Configure regular database backups
7. ✅ Update default user credentials

### Docker Production

```bash
# Build production image
docker-compose build

# Start in production mode
FLASK_ENV=production docker-compose up -d

# Monitor logs
docker-compose logs -f backend
```

## Documentation Files

- **[BACKEND_API.md](BACKEND_API.md)** - Complete API documentation
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[QUICK_START.md](QUICK_START.md)** - Quick start guide
- **Backend-specific docs** in `backend/` directory

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

## License

MIT

## Next Steps

1. Set up your frontend framework
2. Configure API client with base URL `http://localhost:5000`
3. Implement authentication flow
4. Start building your UI components
5. Refer to [BACKEND_API.md](BACKEND_API.md) for available endpoints

---

**Ready to build your frontend?** The backend is fully functional and waiting for your UI! 🚀
