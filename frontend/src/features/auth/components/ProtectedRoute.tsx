import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { Spin } from 'antd';
import { useGetCurrentUserQuery } from '../services/authApi';
import { setCredentials, bootstrapFinished } from '../slices/authSlice';
import { socketService } from '@services/socket';

export const ProtectedRoute = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isBootstrapping, token, user } = useAppSelector((state) => state.auth);

  // Fire /api/auth/me on boot (to probe the HttpOnly cookie) and whenever
  // we're authenticated but don't yet have a user object loaded. 401 is
  // handled by baseApi.ts which dispatches logout.
  const { data: currentUser, isLoading, isError } = useGetCurrentUserQuery(undefined, {
    skip: !!user || (!isAuthenticated && !isBootstrapping),
  });

  // Update Redux state with fetched user data
  useEffect(() => {
    if (currentUser && !user) {
      dispatch(setCredentials({ user: currentUser, token }));
    }
  }, [currentUser, token, user, dispatch]);

  // Exit the bootstrap phase on probe failure so we can redirect to login
  // instead of spinning forever. 401 already logs out via baseApi; this
  // handles 500s and network errors too.
  useEffect(() => {
    if (isError && isBootstrapping) {
      dispatch(bootstrapFinished());
    }
  }, [isError, isBootstrapping, dispatch]);

  // Establish WebSocket connection when authenticated (handles page refresh)
  useEffect(() => {
    if (isAuthenticated && user && !socketService.isConnected()) {
      try {
        socketService.connect(token ?? undefined);
      } catch (err) {
        console.warn('Failed to establish WebSocket connection:', err);
      }
    }
  }, [isAuthenticated, token, user]);

  // Note: 401/403 errors are handled globally in baseApi.ts which dispatches
  // logout (flipping isAuthenticated to false) and redirects.

  // Show loading while we're bootstrapping the session or still waiting on /me.
  if (isBootstrapping || (isAuthenticated && !user && isLoading)) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};
