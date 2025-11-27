import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';
import { Spin } from 'antd';

export const ProtectedRoute = () => {
  const { isAuthenticated, token } = useAppSelector((state) => state.auth);

  // Show loading state while checking authentication
  if (token === undefined) {
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

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};
