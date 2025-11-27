import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { Spin } from 'antd';
import { useGetCurrentUserQuery } from '../services/authApi';
import { setCredentials } from '../slices/authSlice';

export const ProtectedRoute = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, user } = useAppSelector((state) => state.auth);

  // Fetch current user if authenticated but user data is not loaded
  const { data: currentUser, isLoading, isError } = useGetCurrentUserQuery(undefined, {
    skip: !isAuthenticated || !!user,
  });

  // Update Redux state with fetched user data
  useEffect(() => {
    if (currentUser && token && !user) {
      dispatch(setCredentials({ user: currentUser, token }));
    }
  }, [currentUser, token, user, dispatch]);

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

  // If there's an error fetching user or not authenticated, redirect to login
  if (!isAuthenticated || isError) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};
