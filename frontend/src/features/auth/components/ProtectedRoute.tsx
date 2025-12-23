import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { Spin } from 'antd';
import { useGetCurrentUserQuery } from '../services/authApi';
import { setCredentials } from '../slices/authSlice';
import { socketService } from '@services/socket';

export const ProtectedRoute = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, user } = useAppSelector((state) => state.auth);

  // Fetch current user if authenticated but user data is not loaded
  const { data: currentUser, isLoading } = useGetCurrentUserQuery(undefined, {
    skip: !isAuthenticated || !!user,
  });

  // Update Redux state with fetched user data
  useEffect(() => {
    if (currentUser && token && !user) {
      dispatch(setCredentials({ user: currentUser, token }));
    }
  }, [currentUser, token, user, dispatch]);

  // Establish WebSocket connection when authenticated (handles page refresh)
  useEffect(() => {
    if (isAuthenticated && token && user && !socketService.isConnected()) {
      try {
        socketService.connect(token);
      } catch (err) {
        console.warn('Failed to establish WebSocket connection:', err);
      }
    }
  }, [isAuthenticated, token, user]);

  // Note: 401/403 errors are now handled globally in baseApi.ts
  // which will automatically logout and redirect to login

  // Show loading state while checking authentication or fetching user
  if (token === undefined || (isAuthenticated && !user && isLoading)) {
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
