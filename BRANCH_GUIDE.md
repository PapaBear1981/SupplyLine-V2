# Branch Guide

This document tracks active development branches and their purposes.

## Active Branches

### `feature/frontend-antd-setup`
**Created:** November 27, 2025
**Status:** ✅ Foundation Complete - Ready for Feature Development
**Purpose:** Initial frontend setup with Ant Design, Redux, and routing

**What's Included:**
- ✅ Vite + React 19 + TypeScript 5.9 project
- ✅ Ant Design 6.0 UI framework
- ✅ Redux Toolkit + RTK Query for state management
- ✅ React Router v6 with protected routes
- ✅ Authentication system (login, JWT storage)
- ✅ Responsive layouts (mobile-first)
- ✅ Socket.IO client integration
- ✅ Feature-based folder structure

**How to Work on This Branch:**

```bash
# Switch to the branch
git checkout feature/frontend-antd-setup

# Install dependencies
cd frontend
npm install

# Start development server
npm run dev
# Frontend will run at: http://localhost:5173

# Start backend (in separate terminal)
cd ../backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
# Backend will run at: http://localhost:5000

# Build for production
npm run build

# Run linter
npm run lint
```

**Testing the App:**

1. **Start both servers** (frontend at 5173, backend at 5000)
2. **Open browser** to http://localhost:5173
3. **You should be redirected to login** (app is working!)
4. **Login with test credentials:**
   - Employee Number: `ADMIN001`
   - Password: `admin123`
5. **After login**, you should see the dashboard with sidebar navigation

**Next Steps:**
- [ ] Build Tools module (Table, Drawer, Forms, CRUD operations)
- [ ] Add Calibration management
- [ ] Implement barcode scanning
- [ ] Build Chemicals module
- [ ] Build Kits module
- [ ] And so on...

**File Structure:**
```
frontend/
├── src/
│   ├── app/                    # Redux store
│   │   ├── store.ts
│   │   └── hooks.ts
│   ├── features/               # Feature modules
│   │   ├── auth/
│   │   │   ├── components/     # ProtectedRoute
│   │   │   ├── pages/          # LoginPage
│   │   │   ├── services/       # authApi (RTK Query)
│   │   │   ├── slices/         # authSlice
│   │   │   └── types.ts
│   │   ├── dashboard/
│   │   │   └── pages/          # DashboardPage
│   │   └── tools/              # Ready for implementation
│   ├── shared/
│   │   ├── components/
│   │   │   └── layouts/        # MainLayout, AuthLayout
│   │   ├── constants/          # routes, navigation
│   │   ├── hooks/              # useSocket
│   │   └── utils/
│   ├── services/
│   │   ├── baseApi.ts          # RTK Query base
│   │   └── socket.ts           # Socket.IO service
│   ├── App.tsx                 # Router configuration
│   └── main.tsx                # App entry point
```

**Commits on This Branch:**
1. `docs: Add comprehensive frontend build plan` - Architecture planning
2. `feat: Initialize Vite + React + TypeScript frontend` - Project setup
3. `feat: Configure Redux store with RTK Query` - State management
4. `feat: Implement routing, layouts, and authentication UI` - UI foundation
5. `fix: Resolve TypeScript compilation errors` - Build fixes

**Merge Strategy:**
- When Tools module is complete, merge to `master`
- Create new branches for other modules if needed
- Keep commits focused and descriptive

---

## Branch Naming Conventions

Use these prefixes for new branches:
- `feature/` - New features (e.g., `feature/chemicals-module`)
- `fix/` - Bug fixes (e.g., `fix/login-validation`)
- `refactor/` - Code refactoring (e.g., `refactor/api-service`)
- `docs/` - Documentation updates (e.g., `docs/api-guide`)
- `chore/` - Maintenance tasks (e.g., `chore/dependency-updates`)

---

## Useful Commands

```bash
# Check current branch
git branch

# Create new branch
git checkout -b feature/new-feature

# Push branch to remote
git push -u origin feature/new-feature

# See all branches
git branch -a

# Delete local branch (after merge)
git branch -d feature/old-feature

# Switch between branches
git checkout master
git checkout feature/frontend-antd-setup
```
