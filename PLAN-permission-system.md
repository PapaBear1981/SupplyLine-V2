# Comprehensive Permission System Implementation Plan

## Executive Summary

This plan outlines the implementation of a robust, fine-grained permission system for SupplyLine MRO Suite. The system will support:
- **Role-based permissions** (existing - enhance)
- **Department-based permissions** (new)
- **Per-user custom permissions** (new - grants/denies specific to individual users)
- **Complete UI for permission management** (new)
- **Frontend permission enforcement** (new)
- **Missing permission categories** (new - kits, warehouses, orders, requests, etc.)

## Current State Analysis

### What Exists:
1. **RBAC Tables**: `permissions`, `roles`, `role_permissions`, `user_roles`
2. **31 Permissions** across categories: User, Tool, Chemical, Calibration, Reporting, System, Department, Page Access
3. **3 Default Roles**: Administrator, Materials Manager, Maintenance User
4. **Backend Decorators**: `@permission_required`, `@permission_required_any`, `@admin_required`, `@department_required`
5. **Basic Role Management UI** in admin panel (create/edit/delete roles)

### What's Missing:
1. **Per-User Custom Permissions** - ability to grant/deny specific permissions to individual users beyond their roles
2. **Complete Permission UI** - interface to assign permissions to roles, view all permissions
3. **Frontend Permission Hooks** - React components/hooks to check permissions in UI
4. **Missing Permission Categories** - kits, warehouses, orders, requests, messaging, transfers
5. **Page-Level Route Guards** - frontend enforcement of page access permissions
6. **Permission Categories for Actions** - fine-grained action permissions (view vs edit vs delete)

---

## Implementation Plan

### Phase 1: Database Schema Enhancements

#### 1.1 Add User-Specific Permissions Table
Create a new table to allow granting/denying specific permissions to individual users (overrides role-based permissions).

```sql
CREATE TABLE user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    grant_type TEXT NOT NULL CHECK(grant_type IN ('grant', 'deny')),
    granted_by INTEGER NOT NULL,
    reason TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, permission_id)
);
```

#### 1.2 Add Missing Permissions
Add comprehensive permissions for all features:

**Kit Management:**
- `kit.view`, `kit.create`, `kit.edit`, `kit.delete`, `kit.issue`, `kit.reorder`

**Warehouse Management:**
- `warehouse.view`, `warehouse.create`, `warehouse.edit`, `warehouse.delete`, `warehouse.transfer`

**Order Management:**
- `order.view`, `order.create`, `order.edit`, `order.delete`, `order.approve`, `order.fulfill`

**Request Management:**
- `request.view`, `request.create`, `request.edit`, `request.delete`, `request.approve`, `request.fulfill`

**Messaging:**
- `channel.view`, `channel.create`, `channel.manage`, `message.send`, `message.delete`

**Transfers:**
- `transfer.view`, `transfer.create`, `transfer.approve`, `transfer.complete`

**Additional Page Access:**
- `page.settings`, `page.messaging`, `page.transfers`

---

### Phase 2: Backend API Enhancements

#### 2.1 Update User Model
Modify `models.py` to include user-specific permissions in `get_permissions()` and `has_permission()`:

```python
# In User model:
def get_effective_permissions(self):
    """Get all permissions including user-specific grants/denies"""
    # Start with role-based permissions
    permissions = set(self.get_permissions())

    # Apply user-specific overrides
    for up in self.user_permissions:
        if up.is_active():  # Check expiry
            if up.grant_type == 'grant':
                permissions.add(up.permission.name)
            elif up.grant_type == 'deny':
                permissions.discard(up.permission.name)

    return list(permissions)
```

#### 2.2 New API Endpoints

**Permission Management:**
- `GET /api/permissions` - List all permissions (grouped by category)
- `GET /api/permissions/categories` - Get permissions organized by category

**Role-Permission Management:**
- `GET /api/roles/:id/permissions` - Get permissions for a role
- `PUT /api/roles/:id/permissions` - Update permissions for a role

**User-Permission Management:**
- `GET /api/users/:id/permissions` - Get user's effective permissions
- `POST /api/users/:id/permissions` - Grant/deny specific permission to user
- `DELETE /api/users/:id/permissions/:permId` - Remove user-specific permission

**Current User Permissions:**
- `GET /api/auth/permissions` - Get current user's effective permissions (already exists, enhance)

#### 2.3 Update JWT Token
Include effective permissions in JWT payload (already done, ensure user-specific permissions are included).

---

### Phase 3: Frontend Permission System

#### 3.1 Permission Context & Hooks
Create a comprehensive permission system for the frontend:

**Files to create:**
- `frontend/src/features/auth/context/PermissionContext.tsx`
- `frontend/src/features/auth/hooks/usePermission.ts`
- `frontend/src/features/auth/hooks/usePageAccess.ts`
- `frontend/src/features/auth/components/PermissionGuard.tsx`
- `frontend/src/features/auth/components/PageGuard.tsx`

**Hook API:**
```typescript
// Check single permission
const canEdit = usePermission('tool.edit');

// Check any of multiple permissions
const canManage = usePermissionAny(['tool.edit', 'tool.delete']);

// Check all permissions
const canFullManage = usePermissionAll(['tool.edit', 'tool.delete', 'tool.create']);

// Page access check
const canAccessTools = usePageAccess('page.tools');
```

**Component API:**
```tsx
// Guard content based on permission
<PermissionGuard permission="tool.edit" fallback={<AccessDenied />}>
  <EditButton />
</PermissionGuard>

// Guard routes
<PageGuard permission="page.tools">
  <ToolsPage />
</PageGuard>
```

#### 3.2 Update Auth Types
Extend `frontend/src/features/users/types.ts`:

```typescript
export interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
}

export interface UserPermission {
  id: number;
  permission_id: number;
  permission: Permission;
  grant_type: 'grant' | 'deny';
  granted_by: number;
  reason?: string;
  expires_at?: string;
  created_at: string;
}

export interface User {
  // ... existing fields
  roles?: UserRole[];
  permissions?: string[];  // Effective permissions list
  user_permissions?: UserPermission[];  // User-specific overrides
}
```

#### 3.3 Update ProtectedRoute
Enhance `ProtectedRoute.tsx` to check page permissions:

```typescript
export const ProtectedRoute = ({ requiredPermission }: { requiredPermission?: string }) => {
  const { user } = useAuth();
  const hasAccess = usePageAccess(requiredPermission);

  if (requiredPermission && !hasAccess) {
    return <AccessDenied />;
  }

  return <Outlet />;
};
```

---

### Phase 4: Permission Management UI

#### 4.1 Role Permission Editor
Enhance `RoleManagement.tsx` to include permission assignment:

- Tree view of permissions grouped by category
- Checkboxes to enable/disable each permission
- Visual indicator for system roles (Administrator has all permissions)
- Save/Cancel buttons with confirmation

#### 4.2 User Permission Editor
Create new component for managing user-specific permissions:

**File:** `frontend/src/features/admin/components/UserPermissionEditor.tsx`

Features:
- Display user's effective permissions from roles
- Table of user-specific grants/denies
- Add grant/deny modal with:
  - Permission selector (grouped by category)
  - Grant/Deny toggle
  - Optional reason field
  - Optional expiry date
- Remove user-specific permission button
- Clear visual distinction between role-based and user-specific permissions

#### 4.3 Permission Overview Dashboard
Create a permission overview page:

**File:** `frontend/src/features/admin/components/PermissionOverview.tsx`

Features:
- Matrix view: Roles vs Permissions
- Search/filter by permission name or category
- Export to CSV option
- Quick role comparison

---

### Phase 5: Route Protection & UI Enforcement

#### 5.1 Update App.tsx Routes
Add permission guards to all routes:

```tsx
<Route element={<PageGuard permission="page.tools"><MainLayout /></PageGuard>}>
  <Route path="/tools" element={<ToolsPage />} />
</Route>

<Route element={<PageGuard permission="page.chemicals"><MainLayout /></PageGuard>}>
  <Route path="/chemicals" element={<ChemicalsPage />} />
</Route>
```

#### 5.2 Conditional UI Elements
Update all feature components to check permissions before showing action buttons:

```tsx
// In ToolsPage.tsx
{hasPermission('tool.create') && (
  <Button type="primary" onClick={handleCreate}>Add Tool</Button>
)}

{hasPermission('tool.delete') && (
  <Button danger onClick={handleDelete}>Delete</Button>
)}
```

#### 5.3 Sidebar Navigation Filtering
Update navigation to hide inaccessible pages:

```tsx
// In Sidebar.tsx
const menuItems = useMemo(() => {
  return allMenuItems.filter(item =>
    !item.permission || hasPermission(item.permission)
  );
}, [permissions]);
```

---

### Phase 6: Backend Protection Enhancement

#### 6.1 Add Missing Route Decorators
Audit all backend routes and add appropriate permission decorators:

- Kit routes: `@permission_required('kit.*')`
- Warehouse routes: `@permission_required('warehouse.*')`
- Order routes: `@permission_required('order.*')`
- etc.

#### 6.2 Create Permission Audit Log
Log all permission-related actions:

```python
# When granting/denying user permissions
AuditLog.log(
    user_id=current_user_id,
    action="grant_user_permission",
    resource_type="user_permission",
    resource_id=user_id,
    details={
        "permission": permission_name,
        "grant_type": "grant",
        "reason": reason
    }
)
```

---

## File Changes Summary

### New Files to Create:

**Backend:**
1. `backend/migrations/add_user_permissions_table.py`
2. `backend/migrations/add_missing_permissions.py`
3. `backend/routes_permissions.py` (dedicated permissions API)

**Frontend:**
1. `frontend/src/features/auth/context/PermissionContext.tsx`
2. `frontend/src/features/auth/hooks/usePermission.ts`
3. `frontend/src/features/auth/hooks/usePageAccess.ts`
4. `frontend/src/features/auth/components/PermissionGuard.tsx`
5. `frontend/src/features/auth/components/PageGuard.tsx`
6. `frontend/src/features/auth/components/AccessDenied.tsx`
7. `frontend/src/features/admin/components/RolePermissionEditor.tsx`
8. `frontend/src/features/admin/components/UserPermissionEditor.tsx`
9. `frontend/src/features/admin/components/PermissionOverview.tsx`
10. `frontend/src/features/admin/services/permissionsApi.ts`
11. `frontend/src/features/admin/types/permissions.ts`

### Files to Modify:

**Backend:**
1. `backend/models.py` - Add UserPermission model, update User.get_permissions()
2. `backend/auth/jwt_manager.py` - Update token payload with effective permissions
3. `backend/routes_rbac.py` - Enhance with permission assignment endpoints
4. `backend/routes_*.py` - Add missing permission decorators

**Frontend:**
1. `frontend/src/features/users/types.ts` - Add Permission types
2. `frontend/src/features/auth/types.ts` - Add permission-related types
3. `frontend/src/features/auth/slices/authSlice.ts` - Store permissions
4. `frontend/src/features/auth/components/ProtectedRoute.tsx` - Add permission checks
5. `frontend/src/features/admin/components/RoleManagement.tsx` - Add permission editor
6. `frontend/src/features/admin/components/UserManagement.tsx` - Add permission editor link
7. `frontend/src/features/admin/pages/AdminPage.tsx` - Add permissions tab
8. `frontend/src/features/admin/services/adminApi.ts` - Add permission endpoints
9. `frontend/src/App.tsx` - Add page guards to routes
10. `frontend/src/shared/components/Layout/Sidebar.tsx` - Filter menu by permissions

---

## Implementation Order

1. **Phase 1**: Database schema (migration scripts)
2. **Phase 2**: Backend API (models, routes)
3. **Phase 3**: Frontend hooks and context
4. **Phase 4**: Permission management UI
5. **Phase 5**: Route protection and UI enforcement
6. **Phase 6**: Backend protection and audit logging

---

## Testing Checklist

- [ ] Admin has all permissions by default
- [ ] Role-based permissions work correctly
- [ ] User-specific grants add permissions
- [ ] User-specific denies remove permissions
- [ ] Expired user permissions are ignored
- [ ] UI correctly hides/shows elements based on permissions
- [ ] Routes correctly block unauthorized access
- [ ] Permission changes are reflected immediately (or after re-login)
- [ ] Audit logs capture permission changes
- [ ] System roles cannot be deleted
- [ ] Permission removal cascades properly

---

## Security Considerations

1. **Admin Bypass**: Admins always have all permissions (backend enforced)
2. **Permission Caching**: Permissions are cached in JWT - changes require token refresh
3. **Audit Trail**: All permission changes are logged
4. **Expiry Support**: User-specific permissions can have expiry dates
5. **Deny Takes Precedence**: Explicit denies override role-based grants
