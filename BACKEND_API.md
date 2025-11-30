# SupplyLine MRO Suite - Backend API Documentation

## Overview

This document provides an overview of the backend API structure for the SupplyLine MRO Suite. The backend is built with Flask and provides a comprehensive REST API for managing MRO operations.

## Base URL

- **Local Development**: `http://localhost:5000`
- **Docker Deployment**: `http://localhost:5000`

## Authentication

The API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Optimistic Locking (Concurrent Update Handling)

The API implements optimistic locking to prevent data loss when multiple users try to update the same resource simultaneously.

### How It Works

1. Each resource (Chemical, Tool, Kit, etc.) includes a `version` field
2. When fetching a resource, the response includes the current version
3. When updating, include the `version` in your request
4. If the version doesn't match (another user updated it), you get a 409 Conflict

### Example Update Flow

```json
// 1. GET /api/chemicals/123
{
  "id": 123,
  "version": 5,
  "part_number": "CHEM-001",
  "quantity": 100
}

// 2. PUT /api/chemicals/123 - Include the version
{
  "quantity": 75,
  "version": 5
}

// 3. Success response - version is incremented
{
  "id": 123,
  "version": 6,
  "quantity": 75
}
```

### Conflict Response (409)

When a conflict is detected, you receive a 409 response with details:

```json
{
  "error": "This chemical has been modified by another user...",
  "error_code": "version_conflict",
  "conflict_details": {
    "current_version": 6,
    "provided_version": 5,
    "resource_type": "Chemical",
    "resource_id": 123
  },
  "current_data": {
    "id": 123,
    "version": 6,
    "quantity": 90
  },
  "hint": "The resource was modified by another user. Please refresh and try again."
}
```

### Supported Resources

The following resources support optimistic locking:
- **Chemicals** (`/api/chemicals/{id}`)
- **Tools** (`/api/tools/{id}`)
- **Kits** (`/api/kits/{id}`)
- **Warehouses** (`/api/warehouses/{id}`)
- **Procurement Orders** (`/api/orders/{id}`)
- **User Requests** (`/api/requests/{id}`)

### Backwards Compatibility

For backwards compatibility, updates without a `version` field will succeed (with a warning logged). However, including the version is recommended to prevent lost updates.

## API Modules

The backend is organized into the following route modules:

### Core Routes
- **routes.py** - Main application routes and health check endpoint

### Authentication & Authorization
- **routes_auth.py** - User authentication (login, logout, token refresh)
- **routes_rbac.py** - Role-based access control
- **routes_password_reset.py** - Password reset functionality
- **routes_security.py** - Security-related endpoints

### User Management
- **routes_users.py** - User CRUD operations
- **routes_user_requests.py** - User registration and approval workflow
- **routes_departments.py** - Department management

### Tool Management
- **routes.py** - Tool inventory management
- **routes_calibration.py** - Tool calibration tracking
- **routes_scanner.py** - Barcode scanning for tools

### Chemical Management
- **routes_chemicals.py** - Chemical inventory CRUD operations
- **routes_chemical_analytics.py** - Chemical waste and usage analytics

### Kit Management (Mobile Warehouse)
- **routes_kits.py** - Kit creation and management
- **routes_kit_messages.py** - Messaging system for kits
- **routes_kit_reorders.py** - Reorder management for kit items
- **routes_kit_transfers.py** - Kit-to-kit and kit-to-warehouse transfers

### Warehouse Management
- **routes_warehouses.py** - Warehouse location management
- **routes_inventory.py** - Warehouse inventory operations
- **routes_expendables.py** - Expendable items management

### Transfer & Orders
- **routes_transfers.py** - General transfer operations
- **routes_orders.py** - Order management

### Reporting & Analytics
- **routes_reports.py** - Report generation (tools, chemicals, usage)
- **routes_history.py** - Historical data and audit trails

### Barcode & QR Code
- **routes_barcode.py** - Barcode and QR code generation (PDF labels)

### Bulk Operations
- **routes_bulk_import.py** - Bulk import functionality for tools, chemicals, etc.

### Messaging System
- **routes_channels.py** - Communication channels
- **routes_announcements.py** - System announcements
- **routes_message_search.py** - Message search functionality

### File Management
- **routes_attachments.py** - File attachments for various entities

### Database Operations
- **routes_database.py** - Database backup and maintenance

## Health Check Endpoint

```
GET /api/health
```

Returns the health status of the backend service.

## CORS Configuration

The backend is configured to accept requests from the following origins (configurable via `CORS_ORIGINS` environment variable):

- `http://localhost:5173` (Vite dev server default)
- `http://localhost:80` (Docker frontend default)
- `http://localhost`

For production, update the `CORS_ORIGINS` environment variable to include your frontend domain.

## Environment Variables

Key environment variables for backend configuration:

### Required
- `SECRET_KEY` - Flask secret key (generate with: `python -c "import secrets; print(secrets.token_urlsafe(64))"`)
- `JWT_SECRET_KEY` - JWT signing key (generate with: `python -c "import secrets; print(secrets.token_urlsafe(64))"`)

### Optional
- `FLASK_ENV` - Environment (development/production)
- `FLASK_DEBUG` - Debug mode (True/False)
- `FLASK_HOST` - Host to bind (default: 0.0.0.0)
- `FLASK_PORT` - Port to bind (default: 5000)
- `DATABASE_URL` - PostgreSQL connection string (defaults to SQLite)
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `PUBLIC_URL` - Public URL for QR codes (e.g., http://192.168.1.100:5000)

## Database

The backend supports both SQLite (default) and PostgreSQL:

- **SQLite**: Data stored in `database/tools.db`
- **PostgreSQL**: Set `DATABASE_URL` environment variable

## WebSocket Support

The backend includes Socket.IO support for real-time features:

- Messaging notifications
- System announcements
- Inventory updates

## Getting Started with a New Frontend

1. **Start the Backend**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python app.py
   ```

2. **Configure CORS**: Update `.env` file with your frontend URL:
   ```
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173
   ```

3. **Test API Access**:
   ```bash
   curl http://localhost:5000/api/health
   ```

4. **Authentication Flow**:
   - POST to `/api/auth/login` with credentials
   - Receive JWT token in response
   - Include token in Authorization header for subsequent requests

## Default Users

The system includes default users for testing:

- **Admin**: Employee Number `ADMIN001`, Password `admin123`
- **Materials**: Employee Number `MAT001`, Password `materials123`
- **Maintenance**: Employee Number `MAINT001`, Password `maintenance123`

**Note**: Change these credentials in production!

## API Response Format

Successful responses:
```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Rate Limiting

The backend includes rate limiting for authentication endpoints to prevent brute force attacks:
- Maximum 5 failed login attempts
- Account lockout for 15 minutes after max attempts
- Exponential backoff for subsequent lockouts

## Security Features

- JWT token-based authentication
- CSRF protection
- Password history tracking
- Account lockout on failed attempts
- Secure password hashing
- Role-based access control (RBAC)
- Session management
- SQL injection protection via SQLAlchemy ORM

## Next Steps

Refer to individual route files in the `backend/` directory for detailed endpoint documentation and parameters. Each route file contains Flask route definitions with parameters and return values.
