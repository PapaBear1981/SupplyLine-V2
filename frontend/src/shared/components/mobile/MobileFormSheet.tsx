import type { ReactNode } from 'react';
import { Popup, Button, SafeArea } from 'antd-mobile';
import { CloseOutline } from 'antd-mobile-icons';
import './MobilePrimitives.css';

interface MobileFormSheetProps {
  /** Whether the sheet is visible. */
  visible: boolean;
  /** Title displayed in the sheet header. */
  title: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  /** Optional custom submit button label (default: "Save"). */
  submitLabel?: string;
  /** Called when the sheet is dismissed (mask click or close button). */
  onClose: () => void;
  /** Called when the submit button is pressed. Omit to hide the submit button. */
  onSubmit?: () => void | Promise<void>;
  /** Whether the submit button shows a loading state. */
  submitting?: boolean;
  /** Whether the submit button is disabled. */
  submitDisabled?: boolean;
  /** Form content. */
  children: ReactNode;
  /** Whether the sheet should occupy the full screen (useful for multi-step forms). */
  fullScreen?: boolean;
  /** Destroy children on close so RTK Query/form state resets. */
  destroyOnClose?: boolean;
}

/**
 * Bottom-sheet form wrapper used across all mobile create/edit flows.
 *
 * Replaces the ad-hoc Popup usage scattered across mobile feature code and
 * gives every form the same header, footer, and submit UX.
 */
export const MobileFormSheet = ({
  visible,
  title,
  subtitle,
  submitLabel = 'Save',
  onClose,
  onSubmit,
  submitting = false,
  submitDisabled = false,
  children,
  fullScreen = false,
  destroyOnClose = true,
}: MobileFormSheetProps) => {
  const handleSubmit = () => {
    if (onSubmit) {
      const result = onSubmit();
      if (result instanceof Promise) {
        // parent handles errors; we just await so button state is consistent
        result.catch(() => {});
      }
    }
  };

  return (
    <Popup
      visible={visible}
      onMaskClick={submitting ? undefined : onClose}
      onClose={onClose}
      position="bottom"
      destroyOnClose={destroyOnClose}
      bodyStyle={{
        borderTopLeftRadius: fullScreen ? 0 : 16,
        borderTopRightRadius: fullScreen ? 0 : 16,
        height: fullScreen ? '100vh' : 'auto',
        maxHeight: fullScreen ? '100vh' : '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="mobile-form-sheet">
        <div className="mobile-form-sheet__header">
          <div className="mobile-form-sheet__titles">
            <div className="mobile-form-sheet__title">{title}</div>
            {subtitle && <div className="mobile-form-sheet__subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="mobile-form-sheet__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <CloseOutline fontSize={22} />
          </button>
        </div>

        <div className="mobile-form-sheet__body">{children}</div>

        {onSubmit && (
          <div className="mobile-form-sheet__footer">
            <Button block color="default" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              block
              color="primary"
              loading={submitting}
              disabled={submitDisabled}
              onClick={handleSubmit}
            >
              {submitLabel}
            </Button>
          </div>
        )}
        <SafeArea position="bottom" />
      </div>
    </Popup>
  );
};
