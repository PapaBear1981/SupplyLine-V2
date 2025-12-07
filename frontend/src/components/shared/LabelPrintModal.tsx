import { useState, useEffect } from 'react';
import { Modal, Button, Space, Typography, Radio, Alert, message, theme } from 'antd';
import { PrinterOutlined, QrcodeOutlined, BarcodeOutlined } from '@ant-design/icons';
import type { LabelSize, CodeType, LabelPrintModalProps } from '@/types/label';
import { DEFAULT_PRINT_SETTINGS } from '@/types/label';
import { LabelSizeSelector } from './LabelSizeSelector';
import { usePrintToolLabelMutation } from '@/features/tools/services/toolsApi';

const { Text, Title } = Typography;
const { useToken } = theme;

/**
 * Label Print Modal Component
 *
 * Reusable modal for configuring and printing QR code/barcode labels.
 * Supports tools, chemicals, expendables, and kit items.
 */
export const LabelPrintModal = ({
  open,
  onClose,
  itemType,
  itemId,
  kitId,
  itemDescription,
}: LabelPrintModalProps) => {
  // Get default settings for this item type
  const getDefaultSettings = () => {
    switch (itemType) {
      case 'tool':
        return DEFAULT_PRINT_SETTINGS.tools;
      case 'chemical':
        return DEFAULT_PRINT_SETTINGS.chemicals;
      case 'expendable':
        return DEFAULT_PRINT_SETTINGS.expendables;
      case 'kit-item':
        return DEFAULT_PRINT_SETTINGS.kitItems;
      default:
        return DEFAULT_PRINT_SETTINGS.tools;
    }
  };

  const [labelSize, setLabelSize] = useState<LabelSize>(getDefaultSettings().size);
  const [codeType, setCodeType] = useState<CodeType>(getDefaultSettings().codeType);
  const { token } = useToken();

  // Reset to defaults when modal opens
  useEffect(() => {
    if (open) {
      const defaults = getDefaultSettings();
      setLabelSize(defaults.size);
      setCodeType(defaults.codeType);
    }
  }, [open, itemType]);

  // API mutations based on item type
  const [printToolLabel, { isLoading: isPrintingTool }] = usePrintToolLabelMutation();
  // TODO: Add mutations for other item types when implemented
  // const [printChemicalLabel, { isLoading: isPrintingChemical }] = usePrintChemicalLabelMutation();
  // const [printExpendableLabel, { isLoading: isPrintingExpendable }] = usePrintExpendableLabelMutation();
  // const [printKitItemLabel, { isLoading: isPrintingKitItem }] = usePrintKitItemLabelMutation();

  const isPrinting = isPrintingTool; // || isPrintingChemical || isPrintingExpendable || isPrintingKitItem;

  /**
   * Handle print button click
   * Generates PDF and opens in new window
   */
  const handlePrint = async () => {
    try {
      let pdfBlob: Blob | undefined;

      // Call appropriate API based on item type
      switch (itemType) {
        case 'tool':
          pdfBlob = await printToolLabel({
            toolId: itemId,
            labelSize,
            codeType,
          }).unwrap();
          break;

        case 'chemical':
          // TODO: Implement when chemicalsApi has print endpoint
          message.warning('Chemical label printing coming soon!');
          return;

        case 'expendable':
          // TODO: Implement when expendablesApi has print endpoint
          message.warning('Expendable label printing coming soon!');
          return;

        case 'kit-item':
          // TODO: Implement when kitsApi has print endpoint
          if (!kitId) {
            message.error('Kit ID is required for kit item labels');
            return;
          }
          message.warning('Kit item label printing coming soon!');
          return;

        default:
          message.error('Unknown item type');
          return;
      }

      // Create blob URL and open in new window
      if (pdfBlob) {
        const blobUrl = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(blobUrl, '_blank');

        if (!printWindow) {
          // Popup blocked - offer download instead
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `label-${itemType}-${itemId}.pdf`;
          link.click();
          message.info('Label downloaded (popup was blocked)');
        } else {
          message.success('Label generated successfully!');
        }

        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

        // Close modal on success
        onClose();
      }
    } catch (error) {
      console.error('Failed to generate label:', error);
      message.error('Failed to generate label. Please try again.');
    }
  };

  /**
   * Get modal title based on item type
   */
  const getModalTitle = () => {
    const typeLabel = itemType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return `Print ${typeLabel} Label${itemDescription ? ` - ${itemDescription}` : ''}`;
  };

  return (
    <Modal
      title={getModalTitle()}
      open={open}
      onCancel={onClose}
      width={650}
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
        {/* Label Size Selection */}
        <div>
          <Title level={5} style={{ marginBottom: '12px' }}>
            Label Size
          </Title>
          <LabelSizeSelector
            value={labelSize}
            onChange={setLabelSize}
            disabled={isPrinting}
          />
        </div>

        {/* Code Type Selection */}
        <div>
          <Title level={5} style={{ marginBottom: '12px' }}>
            Code Type
          </Title>
          <Radio.Group
            value={codeType}
            onChange={(e) => setCodeType(e.target.value as CodeType)}
            disabled={isPrinting}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Radio
                value="barcode"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: `1px solid ${codeType === 'barcode' ? token.colorPrimary : token.colorBorder}`,
                  borderRadius: token.borderRadius,
                  background: codeType === 'barcode' ? token.colorPrimaryBg : token.colorBgContainer,
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                  <BarcodeOutlined style={{ fontSize: '18px' }} />
                  <div>
                    <Text strong>1D Barcode</Text>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                      Traditional barcode (CODE128) - Works with all barcode scanners
                    </Text>
                  </div>
                </div>
              </Radio>
              <Radio
                value="qrcode"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  border: `1px solid ${codeType === 'qrcode' ? token.colorPrimary : token.colorBorder}`,
                  borderRadius: token.borderRadius,
                  background: codeType === 'qrcode' ? token.colorPrimaryBg : token.colorBgContainer,
                  transition: 'all 0.3s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                  <QrcodeOutlined style={{ fontSize: '18px' }} />
                  <div>
                    <Text strong>QR Code</Text>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                      2D QR code - Stores more data, scannable by smartphones
                    </Text>
                  </div>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* Info Alert */}
        <Alert
          message="Label Preview"
          description={
            <div>
              <Text>
                The generated label will be a professional PDF optimized for the{' '}
                <Text strong>{labelSize}</Text> size with a{' '}
                <Text strong>{codeType === 'barcode' ? '1D barcode' : 'QR code'}</Text>.
                The PDF will open in a new window/tab where you can print or save it.
              </Text>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  );
};
