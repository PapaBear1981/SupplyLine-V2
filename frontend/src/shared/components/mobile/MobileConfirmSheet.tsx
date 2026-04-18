import type { ReactNode } from 'react';
import { Popup, Button, SafeArea } from 'antd-mobile';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import './MobilePrimitives.css';

interface MobileConfirmSheetProps {
  visible: boolean;
  title: string;
  description?: ReactNode;
  /** Confirm button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Destructive action uses danger color. */
  danger?: boolean;
  /** Whether the confirm button is loading. */
  loading?: boolean;
  /** Called when the confirm button is pressed. */
  onConfirm: () => void | Promise<void>;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

/**
 * Bottom-sheet confirmation dialog used for destructive or stateful
 * actions on mobile (delete kit, cancel order, revoke checkout, etc.).
 */
export const MobileConfirmSheet = ({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: MobileConfirmSheetProps) => {
  const handleConfirm = () => {
    const result = onConfirm();
    if (result instanceof Promise) {
      result.catch(() => {});
    }
  };

  return (
    <Popup
      visible={visible}
      onMaskClick={loading ? undefined : onClose}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
      }}
    >
      <div className="mobile-confirm-sheet">
        <div className="mobile-confirm-sheet__icon">
          <ExclamationCircleOutlined style={{ color: danger ? '#ff4d4f' : '#faad14' }} />
        </div>
        <div className="mobile-confirm-sheet__title">{title}</div>
        {description && (
          <div className="mobile-confirm-sheet__description">{description}</div>
        )}
        <div className="mobile-confirm-sheet__actions">
          <Button block onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            block
            color={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
        <SafeArea position="bottom" />
      </div>
    </Popup>
  );
};
