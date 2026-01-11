# Inactivity Timer Fix - Implementation Summary

## Problem Identified
Users were being logged out **early** (after ~15 minutes) despite the configured 30-minute inactivity timeout.

### Root Causes Found:
1. **JWT Token Expiration Mismatch**: Access tokens were hardcoded to expire after 15 minutes, while session timeout was configured for 30 minutes
2. **No Automatic Token Refresh**: Tokens were not automatically refreshed on API calls
3. **No Frontend Activity Tracking**: Only API requests reset the timer, not actual user interactions
4. **No Warning Before Logout**: Users were logged out without any advance notice

---

## Solutions Implemented

### 1. Backend: Configurable JWT Token Expiration ✅

**File Modified**: `backend/auth/jwt_manager.py`

**Changes**:
- Made JWT access token expiration **configurable** instead of hardcoded
- Token lifetime now matches `SESSION_INACTIVITY_TIMEOUT_MINUTES` from config (default: 30 minutes)
- Updated token generation to use dynamic expiration: `timedelta(minutes=access_token_minutes)`
- Updated `expires_in` response to return actual token lifetime in seconds

**Impact**: JWT tokens now expire at the same time as the session timeout, eliminating the early logout issue.

---

### 2. Frontend: Automatic Token Refresh ✅

**Files Modified**:
- `frontend/src/services/baseApi.ts`
- `frontend/src/features/auth/services/authApi.ts`
- `frontend/src/features/auth/slices/authSlice.ts`
- `frontend/src/features/auth/types.ts`

**Changes**:
- Added `refreshToken` mutation endpoint to authApi
- Implemented automatic token refresh in `baseQueryWithAuth`:
  - Checks if token expires within 2 minutes before each API call
  - Automatically refreshes token using refresh token cookie
  - Updates Redux state with new token and expiration
  - Prevents race conditions with `isRefreshing` flag
- Added `setTokenExpiration()` function to track token expiry
- Updated `setCredentials` to accept and store `expiresIn` parameter
- Stores token expiration in localStorage for cross-component access

**Impact**: Users stay logged in as long as they're making API calls, with seamless token renewal.

---

### 3. Frontend: User Activity Tracking ✅

**Files Created**:
- `frontend/src/shared/hooks/useActivityTracker.ts`

**Files Modified**:
- `frontend/src/shared/components/layouts/MainLayout.tsx`

**Changes**:
- Created custom hook `useActivityTracker` that monitors:
  - Mouse movements
  - Keyboard input
  - Clicks
  - Scroll events
  - Touch events (for mobile)
- Throttles activity updates to once per 30 seconds (prevents excessive updates)
- Stores last activity timestamp in localStorage
- Only tracks activity when user is authenticated
- Integrated into MainLayout so it runs whenever user is logged in

**Impact**: System now knows when user is actively using the app, not just when they make API calls.

---

### 4. Frontend: Session Expiry Warning Modal ✅

**Files Created**:
- `frontend/src/shared/components/SessionExpiryWarning/SessionExpiryWarning.tsx`
- `frontend/src/shared/components/SessionExpiryWarning/index.ts`

**Files Modified**:
- `frontend/src/shared/components/layouts/MainLayout.tsx`

**Changes**:
- Created modal component that:
  - Shows warning **3 minutes** before token expiration
  - Displays countdown timer with progress bar
  - Provides "Stay Logged In" button to refresh token
  - Auto-hides if user refreshes token or time threshold changes
  - Reads token expiration from localStorage
- Integrated into MainLayout for app-wide coverage

**Impact**: Users get advance warning before logout and can extend their session with one click.

---

### 5. Cleanup: Logout Enhancement ✅

**Files Modified**:
- `frontend/src/features/auth/slices/authSlice.ts`

**Changes**:
- Updated logout action to clear all auth-related localStorage items:
  - `access_token`
  - `token_expires_at`
  - `last_user_activity`

**Impact**: Clean logout with no stale data.

---

### 6. Login Flow Updates ✅

**Files Modified**:
- `frontend/src/features/auth/pages/LoginPage.tsx`
- `frontend/src/features/auth/components/mobile/MobileLoginForm.tsx`

**Changes**:
- Updated login handlers to pass `expiresIn` to `setCredentials`
- Ensures token expiration is tracked from the moment user logs in
- Works for both desktop and mobile login flows

**Impact**: Token expiration tracking starts immediately on login.

---

## Technical Details

### Token Lifecycle Flow

```
1. User logs in
   ↓
2. Backend generates JWT with configurable expiration (30 min)
   ↓
3. Frontend stores token + expiration time
   ↓
4. User interacts with app
   ↓
5. Activity tracker records user activity
   ↓
6. API calls check token expiration
   ↓
7. If token expires < 2 min: Auto-refresh
   ↓
8. If token expires < 3 min: Show warning modal
   ↓
9. User clicks "Stay Logged In": Refresh token
   ↓
10. Token refreshed → Session extended
```

### Configuration

**Backend** (`backend/config.py`):
```python
SESSION_INACTIVITY_TIMEOUT_MINUTES = 30  # Configurable via env var
```

**Frontend Constants**:
- Token refresh threshold: **2 minutes** before expiration
- Warning threshold: **3 minutes** before expiration
- Activity tracking throttle: **30 seconds**

---

## Files Changed Summary

### Backend (1 file)
- `backend/auth/jwt_manager.py`

### Frontend (11 files)
**Modified**:
- `frontend/src/services/baseApi.ts`
- `frontend/src/features/auth/services/authApi.ts`
- `frontend/src/features/auth/slices/authSlice.ts`
- `frontend/src/features/auth/types.ts`
- `frontend/src/features/auth/pages/LoginPage.tsx`
- `frontend/src/features/auth/components/mobile/MobileLoginForm.tsx`
- `frontend/src/shared/components/layouts/MainLayout.tsx`

**Created**:
- `frontend/src/shared/hooks/useActivityTracker.ts`
- `frontend/src/shared/components/SessionExpiryWarning/SessionExpiryWarning.tsx`
- `frontend/src/shared/components/SessionExpiryWarning/index.ts`

---

## Testing Completed

✅ **Frontend Build**: Successful with no TypeScript errors
✅ **Code Review**: All changes reviewed and validated
✅ **Integration**: Components properly integrated into existing architecture

---

## Expected Behavior After Fix

1. **Login**: User logs in and receives 30-minute token
2. **Active Use**: As long as user is active (moving mouse, typing, clicking), activity is tracked
3. **API Calls**: Any API call within 28 minutes triggers automatic token refresh
4. **Warning**: At 27 minutes, user sees warning modal with countdown
5. **Extension**: User clicks "Stay Logged In" to refresh token and reset timer
6. **Logout**: If no action taken, user is logged out at 30 minutes

---

## Recommendations

1. **Monitor**: Watch server logs for JWT token refresh patterns
2. **Adjust**: If needed, adjust warning threshold (currently 3 min) via `SessionExpiryWarning.tsx`
3. **Test**: Have users test the new flow and provide feedback
4. **Security**: Consider adding rate limiting to refresh endpoint if not already present

---

## Branch Information

**Branch**: `troubleshoot/inactivity-timer`
**Base**: `feat/checkout-user-selection`

All changes are committed and ready for testing.
