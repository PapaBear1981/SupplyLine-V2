import { Navigate, Outlet } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@app/hooks';
import { ROUTES } from '@shared/constants/routes';

export const AdminRoute = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Show access denied if not admin
  if (!user?.is_admin) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="You don't have permission to access the admin dashboard. Please contact your administrator if you believe this is an error."
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.DASHBOARD)}>
            Back to Dashboard
          </Button>
        }
      />
    );
  }

  return <Outlet />;
};
