import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@shared/constants/routes';

interface AccessDeniedProps {
  title?: string;
  subTitle?: string;
  showBackButton?: boolean;
  backTo?: string;
  backButtonText?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  title = 'Access Denied',
  subTitle = "You don't have permission to access this page. Please contact your administrator if you believe this is an error.",
  showBackButton = true,
  backTo = ROUTES.DASHBOARD,
  backButtonText = 'Back to Dashboard',
}) => {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title={title}
      subTitle={subTitle}
      extra={
        showBackButton && (
          <Button type="primary" onClick={() => navigate(backTo)}>
            {backButtonText}
          </Button>
        )
      }
    />
  );
};

export default AccessDenied;
