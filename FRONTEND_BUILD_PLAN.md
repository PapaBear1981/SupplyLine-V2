# Frontend Build Plan - Ant Design + TypeScript

**Date:** November 27, 2025
**Framework:** React + Vite + TypeScript + Ant Design
**State Management:** Redux Toolkit + RTK Query
**Status:** 🚀 Ready to Build

## Architecture Decisions

✅ **Project Structure:** Feature-based (scalable for 29 backend modules)
✅ **State Management:** Redux Toolkit + RTK Query (centralized state + data fetching)
✅ **Language:** TypeScript (type safety for large codebase)
✅ **UI Framework:** Ant Design 5.x (modern, comprehensive component library)
✅ **Routing:** React Router v6
✅ **Mobile:** Responsive from day 1 (Ant Design Grid system)
✅ **Real-time:** Socket.IO client (for tooling updates, messaging)

---

## Phase 1: Foundation Setup

### 1.1 Project Creation
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
```

### 1.2 Core Dependencies
```bash
# UI Framework
npm install antd

# State Management
npm install @reduxjs/toolkit react-redux

# Routing
npm install react-router-dom

# API & Real-time
npm install axios socket.io-client

# Utilities
npm install dayjs  # Ant Design's recommended date library
```

### 1.3 Dev Dependencies
```bash
npm install -D @types/node
npm install -D sass  # For custom styles if needed
```

---

## Phase 2: Folder Structure

```
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── store.ts                    # Redux store configuration
│   │   └── hooks.ts                    # Typed Redux hooks
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── pages/
│   │   │   │   └── LoginPage.tsx
│   │   │   ├── slices/
│   │   │   │   └── authSlice.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── tools/
│   │   │   ├── components/
│   │   │   │   ├── ToolsTable.tsx
│   │   │   │   ├── ToolDrawer.tsx      # View/Edit tool
│   │   │   │   ├── ToolForm.tsx
│   │   │   │   └── CalibrationCard.tsx
│   │   │   ├── pages/
│   │   │   │   └── ToolsPage.tsx
│   │   │   ├── services/
│   │   │   │   └── toolsApi.ts         # RTK Query endpoints
│   │   │   └── types.ts
│   │   │
│   │   ├── chemicals/                   # Phase 3
│   │   ├── kits/                        # Phase 4
│   │   ├── warehouses/                  # Phase 4
│   │   ├── reports/                     # Phase 5
│   │   └── dashboard/
│   │       ├── components/
│   │       │   └── StatsCards.tsx
│   │       └── pages/
│   │           └── DashboardPage.tsx
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── layouts/
│   │   │   │   ├── MainLayout.tsx      # Sider + Header + Content
│   │   │   │   └── AuthLayout.tsx
│   │   │   ├── ScannerModal.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useSocket.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   └── validators.ts
│   │   └── constants/
│   │       ├── routes.ts
│   │       └── permissions.ts
│   │
│   ├── services/
│   │   ├── api.ts                       # Axios instance with interceptors
│   │   ├── socket.ts                    # Socket.IO configuration
│   │   └── baseApi.ts                   # RTK Query base API
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.development
```

---

## Phase 3: Core Configuration Files

### 3.1 Vite Config (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
})
```

### 3.2 TypeScript Config (`tsconfig.json`)
- Enable path aliases matching Vite config
- Strict mode for type safety

### 3.3 Environment Variables (`.env.development`)
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## Phase 4: Redux Setup

### 4.1 Store Structure
```typescript
// app/store.ts
import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from '@services/baseApi'
import authReducer from '@features/auth/slices/authSlice'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
```

### 4.2 RTK Query Base API
```typescript
// services/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('access_token')
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      return headers
    },
  }),
  tagTypes: ['Tool', 'Chemical', 'Kit', 'Warehouse', 'User'],
  endpoints: () => ({}),
})
```

### 4.3 Feature APIs (Inject Endpoints)
```typescript
// features/tools/services/toolsApi.ts
import { baseApi } from '@services/baseApi'

export const toolsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTools: builder.query({
      query: () => '/api/tools',
      providesTags: ['Tool'],
    }),
    getTool: builder.query({
      query: (id) => `/api/tools/${id}`,
      providesTags: (result, error, id) => [{ type: 'Tool', id }],
    }),
    createTool: builder.mutation({
      query: (body) => ({
        url: '/api/tools',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tool'],
    }),
    // ... more endpoints
  }),
})

export const { useGetToolsQuery, useGetToolQuery, useCreateToolMutation } = toolsApi
```

---

## Phase 5: Authentication Implementation

### 5.1 Auth Slice
```typescript
// features/auth/slices/authSlice.ts
interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// Actions: login, logout, setCredentials
```

### 5.2 Login Flow
1. User submits login form
2. Call `/api/auth/login`
3. Store JWT in localStorage
4. Store user in Redux state
5. Redirect to dashboard

### 5.3 Protected Routes
```typescript
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="tools" element={<ToolsPage />} />
    // ... more routes
  </Route>
</Route>
```

---

## Phase 6: Main Layout (Mobile Responsive)

### 6.1 Ant Design Layout Components
```typescript
<Layout style={{ minHeight: '100vh' }}>
  <Sider
    collapsible
    breakpoint="lg"           // Auto-collapse on mobile
    collapsedWidth="0"        // Hide completely on mobile
  >
    <Menu items={menuItems} />
  </Sider>

  <Layout>
    <Header>
      <Breadcrumb />
      <UserMenu />
    </Header>

    <Content style={{ padding: '16px' }}>
      <Outlet />  {/* Child routes render here */}
    </Content>
  </Layout>
</Layout>
```

### 6.2 Mobile Responsive Strategy
- Use Ant Design `Grid` system (`Row`, `Col` with responsive props)
- `xs`, `sm`, `md`, `lg`, `xl` breakpoints
- Tables with `scroll={{ x: true }}` for horizontal scrolling
- Modals → Drawers on mobile for better UX
- Touch-friendly button sizes (minimum 44x44px)

---

## Phase 7: Tools Module (First Feature)

### 7.1 Tools Page Components

**ToolsTable.tsx:**
- Ant Design `Table` component
- Columns: Tool Number, Description, Location, Status, Calibration Due, Actions
- Pagination (server-side recommended)
- Filters: Search, Status, Location, Calibration Status
- Actions: View, Edit, Delete, Generate QR Code
- Responsive: Scroll horizontally on mobile

**ToolDrawer.tsx:**
- Ant Design `Drawer` (slides from right)
- View mode: Display tool details
- Edit mode: Form for updating
- Tabs: Details, Calibration History, QR Code
- Close button

**ToolForm.tsx:**
- Ant Design `Form` with validation
- Fields: Tool Number, Description, Category, Location, etc.
- File upload for calibration certificates
- Submit → RTK Query mutation

**CalibrationCard.tsx:**
- Display next calibration due date
- Status badge (Due Soon, Overdue, Current)
- History timeline

### 7.2 API Integration (RTK Query)
```typescript
const { data: tools, isLoading, error } = useGetToolsQuery()
const [createTool] = useCreateToolMutation()
const [updateTool] = useUpdateToolMutation()
const [deleteTool] = useDeleteToolMutation()
```

### 7.3 Mobile Optimizations
- Table → List view on mobile (using `List` component)
- Drawer instead of Modal for tool details
- Touch-friendly action buttons
- Swipe actions for quick operations

---

## Phase 8: Additional Features

### 8.1 Barcode/Scanner Integration
- Camera access for QR scanning
- Integration with `/api/scanner/*` endpoints
- Quick lookup by scanning

### 8.2 Real-time Updates (Socket.IO)
```typescript
socket.on('tool_updated', (data) => {
  // Invalidate RTK Query cache
  dispatch(toolsApi.util.invalidateTags(['Tool']))
})
```

### 8.3 Notifications
- Ant Design `notification` for important alerts
- Ant Design `message` for success/error feedback

---

## Development Checklist

### Foundation
- [ ] Create Vite + React + TypeScript project
- [ ] Install all dependencies
- [ ] Set up folder structure
- [ ] Configure Vite with aliases and proxy
- [ ] Configure TypeScript

### Redux & API
- [ ] Set up Redux store
- [ ] Create base API slice (RTK Query)
- [ ] Create auth slice
- [ ] Create typed hooks

### Layout & Routing
- [ ] Create MainLayout (responsive)
- [ ] Create AuthLayout
- [ ] Set up React Router
- [ ] Implement ProtectedRoute

### Authentication
- [ ] Create LoginPage
- [ ] Create LoginForm
- [ ] Implement login logic (Redux + API)
- [ ] Handle JWT storage and refresh
- [ ] Add logout functionality

### Tools Module
- [ ] Create ToolsPage
- [ ] Create ToolsTable (responsive)
- [ ] Create ToolDrawer
- [ ] Create ToolForm
- [ ] Implement CRUD operations (RTK Query)
- [ ] Add calibration tracking
- [ ] Implement search and filters
- [ ] Add QR code generation

### Testing & Polish
- [ ] Test on mobile devices/responsive modes
- [ ] Error handling and loading states
- [ ] Form validation
- [ ] Optimize performance
- [ ] Add proper TypeScript types

---

## Next Steps After Tools Module

1. **Chemicals Module** (similar to Tools)
2. **Kits Module** (more complex - nested items)
3. **Warehouses Module**
4. **Reports & Analytics** (charts with recharts or Ant Design Charts)
5. **Messaging System** (real-time with Socket.IO)
6. **User Management** (admin features)

---

## Performance Considerations

- **Code Splitting:** Use React.lazy() for route-based splitting
- **Memoization:** Use React.memo() for expensive components
- **Virtualization:** For very long lists (react-window)
- **Image Optimization:** Lazy load images
- **Bundle Size:** Monitor with `vite-plugin-bundle-analyzer`

---

## Mobile Testing Strategy

- **Browser DevTools:** Chrome/Firefox responsive mode
- **Real Devices:** Test on actual phones/tablets
- **Breakpoints to Test:**
  - xs: < 576px (mobile)
  - sm: ≥ 576px (large mobile)
  - md: ≥ 768px (tablet)
  - lg: ≥ 992px (desktop)
  - xl: ≥ 1200px (large desktop)

---

**Ready to start building!** 🚀
