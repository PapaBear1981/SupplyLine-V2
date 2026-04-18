import { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Button, Space, Typography, Alert, message, theme } from 'antd';
import { PrinterOutlined, QrcodeOutlined } from '@ant-design/icons';
import type { LabelSize, LabelPrintModalProps } from '@/types/label';
import { DEFAULT_PRINT_SETTINGS } from '@/types/label';
import { LabelSizeSelector } from './LabelSizeSelector';
import { usePrintToolLabelMutation } from '@/features/tools/services/toolsApi';
import { usePrintChemicalLabelMutation } from '@/features/chemicals/services/chemicalsApi';
import { usePrintKitItemLabelMutation } from '@/features/kits/services/kitsApi';

const { Text, Title } = Typography;
const { useToken } = theme;

const getDefaultSize = (itemType: LabelPrintModalProps['itemType']): LabelSize => {
  switch (itemType) {
    case 'tool':       return DEFAULT_PRINT_SETTINGS.tools.size;
    case 'chemical':   return DEFAULT_PRINT_SETTINGS.chemicals.size;
    case 'expendable': return DEFAULT_PRINT_SETTINGS.expendables.size;
    case 'kit-item':   return DEFAULT_PRINT_SETTINGS.kitItems.size;
    default:           return DEFAULT_PRINT_SETTINGS.tools.size;
  }
};

export const LabelPrintModal = ({
  open,
  onClose,
  itemType,
  itemId,
  kitId,
  kitItemSubType,
  itemDescription,
}: LabelPrintModalProps) => {
  const defaultSize = useMemo(() => getDefaultSize(itemType), [itemType]);
  const [labelSize, setLabelSize] = useState<LabelSize>(defaultSize);
  const { token } = useToken();

  const blobUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  const resetFormState = () => setLabelSize(defaultSize);

  const [printToolLabel,    { isLoading: isPrintingTool }]     = usePrintToolLabelMutation();
  const [printChemicalLabel,{ isLoading: isPrintingChemical }] = usePrintChemicalLabelMutation();
  const [printKitItemLabel, { isLoading: isPrintingKitItem }]  = usePrintKitItemLabelMutation();

  const isPrinting = isPrintingTool || isPrintingChemical || isPrintingKitItem;

  const handlePrint = async () => {
    try {
      let pdfBlob: Blob | undefined;

      switch (itemType) {
        case 'tool':
          pdfBlob = await printToolLabel({ toolId: itemId, labelSize, codeType: 'qrcode' }).unwrap();
          break;

        case 'chemical':
          pdfBlob = await printChemicalLabel({ chemicalId: itemId, labelSize, codeType: 'qrcode' }).unwrap();
          break;

        case 'expendable':
          if (!kitId) { message.error('Kit ID is required for expendable labels'); return; }
          pdfBlob = await printKitItemLabel({ kitId, itemId, itemType: 'expendable', labelSize, codeType: 'qrcode' }).unwrap();
          break;

        case 'kit-item':
          if (!kitId) { message.error('Kit ID is required for kit item labels'); return; }
          pdfBlob = await printKitItemLabel({ kitId, itemId, itemType: kitItemSubType ?? 'tool', labelSize, codeType: 'qrcode' }).unwrap();
          break;

        default:
          message.error('Unknown item type');
          return;
      }

      if (pdfBlob) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        blobUrlsRef.current.push(blobUrl);

        const printWindow = window.open(blobUrl, '_blank');
        if (!printWindow) {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `label-${itemType}-${itemId}.pdf`;
          link.click();
          message.info('Label downloaded (popup was blocked)');
        } else {
          message.success('Label generated successfully!');
        }
        onClose();
      }
    } catch (error) {
      console.error('Failed to generate label:', error);
      message.error('Failed to generate label. Please try again.');
    }
  };

  const getModalTitle = () => {
    const typeLabel = itemType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return `Print ${typeLabel} Label${itemDescription ? ` – ${itemDescription}` : ''}`;
  };

  return (
    <Modal
      title={getModalTitle()}
      open={open}
      onCancel={onClose}
      afterClose={resetFormState}
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isPrinting}>
          Cancel
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          loading={isPrinting}
        >
          Print Label
        </Button>,
      ]}
      maskClosable={!isPrinting}
      closable={!isPrinting}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Label Size */}
        <div role="group" aria-labelledby="label-size-label">
          <Title level={5} id="label-size-label" style={{ marginBottom: token.marginSM }}>
            Label Size
          </Title>
          <LabelSizeSelector value={labelSize} onChange={setLabelSize} disabled={isPrinting} />
        </div>

        {/* Info */}
        <Alert
          icon={<QrcodeOutlined />}
          message="QR Code Label"
          description={
            <Text>
              A QR code label sized for <Text strong>{labelSize}</Text> will be generated as a
              PDF on standard letter paper with a dashed cut line. Print and cut to size.
            </Text>
          }
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  );
};
