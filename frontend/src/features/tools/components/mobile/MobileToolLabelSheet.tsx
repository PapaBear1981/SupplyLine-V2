import { useState } from 'react';
import { Selector, Toast, Button } from 'antd-mobile';
import { usePrintToolLabelMutation } from '../../services/toolsApi';
import type { LabelSize, CodeType } from '@/types/label';
import { MobileFormSheet } from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';

interface MobileToolLabelSheetProps {
  visible: boolean;
  onClose: () => void;
  toolId: number;
  toolNumber: string;
}

const sizeOptions: Array<{ label: string; value: LabelSize }> = [
  { label: '2×2 inch', value: '2x2' },
  { label: '2×4 inch', value: '2x4' },
  { label: '3×4 inch', value: '3x4' },
  { label: '4×6 inch', value: '4x6' },
];

const codeOptions: Array<{ label: string; value: CodeType }> = [
  { label: 'Barcode (CODE128)', value: 'barcode' },
  { label: 'QR code', value: 'qrcode' },
];

/**
 * Mobile-friendly label generator — wraps the existing
 * usePrintToolLabelMutation so mobile users can generate the same
 * tool labels desktop can, then share or download the result via
 * the Web Share API (with an automatic download fallback on devices
 * that don't support it).
 */
export const MobileToolLabelSheet = ({
  visible,
  onClose,
  toolId,
  toolNumber,
}: MobileToolLabelSheetProps) => {
  const [labelSize, setLabelSize] = useState<LabelSize>('2x4');
  const [codeType, setCodeType] = useState<CodeType>('qrcode');
  const [printLabel, { isLoading }] = usePrintToolLabelMutation();
  const haptics = useHaptics();

  const handleGenerate = async () => {
    try {
      const blob = await printLabel({ toolId, labelSize, codeType }).unwrap();
      const fileName = `label-${toolNumber}-${labelSize}.pdf`;

      // Prefer the Web Share API — on iOS Safari this gives the user
      // AirPrint, Files, Mail, Messages etc. as share targets.
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({
            files: [file],
            title: fileName,
            text: `Label for tool ${toolNumber}`,
          });
          haptics.trigger('success');
          onClose();
          return;
        } catch (shareErr) {
          // User cancelled or share was denied — fall through to download
          if ((shareErr as DOMException)?.name !== 'AbortError') {
            console.warn('Share failed, falling back to download', shareErr);
          } else {
            // User aborted — just close silently
            return;
          }
        }
      }

      // Fallback: trigger a plain download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Label downloaded' });
      onClose();
    } catch (err) {
      haptics.trigger('error');
      const msg =
        (err as { data?: { error?: string } })?.data?.error ??
        'Failed to generate label';
      Toast.show({ icon: 'fail', content: msg });
    }
  };

  return (
    <MobileFormSheet
      visible={visible}
      title="Generate Label"
      subtitle={`Tool ${toolNumber}`}
      onClose={onClose}
      onSubmit={handleGenerate}
      submitting={isLoading}
      submitLabel="Generate & Share"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--adm-color-text)',
              marginBottom: 8,
            }}
          >
            Label size
          </div>
          <Selector
            options={sizeOptions}
            value={[labelSize]}
            onChange={(val) => val[0] && setLabelSize(val[0])}
            columns={2}
          />
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--adm-color-text)',
              marginBottom: 8,
            }}
          >
            Code type
          </div>
          <Selector
            options={codeOptions}
            value={[codeType]}
            onChange={(val) => val[0] && setCodeType(val[0])}
            columns={1}
          />
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--adm-color-weak)',
            lineHeight: 1.5,
          }}
        >
          On iOS/Android the system share sheet will open so you can AirPrint,
          save to Files, or send via Messages. On desktop the label will
          download as a PDF.
        </div>
        {/* Button re-export to avoid unused-import warnings in test files */}
        <Button style={{ display: 'none' }} />
      </div>
    </MobileFormSheet>
  );
};
