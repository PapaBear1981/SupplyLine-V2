import { Result, Button } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@shared/constants/routes';
import { DesktopOutlined } from '@ant-design/icons';

interface DesktopOnlyMessageProps {
  title?: string;
  description?: string;
}

/**
 * Component to display when a page is only available on desktop
 */
export const DesktopOnlyMessage = ({
  title = 'Desktop Only',
  description = 'This feature is only available on desktop. Please access it from a computer.',
}: DesktopOnlyMessageProps) => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '48px 16px' }}>
      <Result
        icon={<DesktopOutlined style={{ fontSize: 48, color: 'var(--adm-color-primary)' }} />}
        status="info"
        title={title}
        description={description}
      />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <Button
          color="primary"
          onClick={() => navigate(ROUTES.DASHBOARD)}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};
