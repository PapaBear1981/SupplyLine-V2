import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface QueryErrorAlertProps {
  message?: string;
  description?: string;
  onRetry?: () => void;
  style?: React.CSSProperties;
}

/**
 * A standardised error alert for RTK Query fetch failures.
 * Shows an error message and an optional retry button.
 */
export const QueryErrorAlert = ({
  message = 'Failed to load data',
  description = 'An error occurred while fetching data. Please try again.',
  onRetry,
  style,
}: QueryErrorAlertProps) => {
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      description={description}
      style={style}
      action={
        onRetry ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    />
  );
};

export default QueryErrorAlert;
