import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { Spin } from 'antd';
import { useGetCurrentUserQuery } from '../services/authApi';
import { setCredentials, logout } from '../slices/authSlice';

export const ProtectedRoute = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, user } = useAppSelector((state) => state.auth);

  // Fetch current user if authenticated but user data is not loaded
  const { data: currentUser, isLoading, isError, error } = useGetCurrentUserQuery(undefined, {
    skip: !isAuthenticated || !!user,
  });

  // Update Redux state with fetched user data
  useEffect(() => {
    if (currentUser && token && !user) {
      dispatch(setCredentials({ user: currentUser, token }));
    }
  }, [currentUser, token, user, dispatch]);

  // Handle authentication errors - only logout on 401/403
  useEffect(() => {
    if (isError && error) {
      // Check if error has status property (FetchBaseQueryError)
      if ('status' in error) {
        // Only logout on actual authentication errors (401, 403)
        if (error.status === 401 || error.status === 403) {
          dispatch(logout());
        }
      }
      // For non-status errors (network/parsing), don't logout
    }
  }, [isError, error, dispatch]);

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
