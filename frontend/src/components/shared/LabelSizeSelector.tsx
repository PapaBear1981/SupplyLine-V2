import { memo } from 'react';
import { Radio, Space, Typography, Tooltip, theme } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { LabelSize } from '@/types/label';
import { LABEL_SIZE_INFO } from '@/types/label';

const { Text } = Typography;
const { useToken } = theme;

interface LabelSizeSelectorProps {
  /** Currently selected label size */
  value: LabelSize;
  /** Callback when selection changes */
  onChange: (size: LabelSize) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Label Size Selector Component
 *
 * Visual selector for choosing label size with helpful information
 * about each size option including dimensions, use cases, and field counts.
 * Memoized to prevent unnecessary re-renders when parent state changes.
 */
export const LabelSizeSelector = memo(function LabelSizeSelector({
  value,
  onChange,
  disabled = false,
}: LabelSizeSelectorProps) {
  const { token } = useToken();

  return (
    <Radio.Group
      value={value}
      onChange={(e) => onChange(e.target.value as LabelSize)}
      disabled={disabled}
      style={{ width: '100%' }}
      aria-label="Select label size"
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {(Object.keys(LABEL_SIZE_INFO) as LabelSize[]).map((size) => {
          const info = LABEL_SIZE_INFO[size];
          const isSelected = value === size;
          const descriptionId = `label-size-desc-${size}`;

          return (
            <Radio
              key={size}
              value={size}
              aria-describedby={descriptionId}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: token.paddingSM,
                border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorder}`,
                borderRadius: token.borderRadius,
                background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                transition: 'all 0.3s',
              }}
            >
              <div style={{ marginLeft: token.marginXS, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, marginBottom: token.marginXXS }}>
                  <Text strong style={{ fontSize: token.fontSize }}>
                    {info.dimensions} - {info.name}
                  </Text>
                  <Tooltip
                    title={
                      <div>
                        <div><strong>Use Case:</strong> {info.useCase}</div>
                        <div><strong>Examples:</strong> {info.examples}</div>
                      </div>
                    }
                  >
                    <InfoCircleOutlined
                      style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
                      aria-label={`More info about ${info.name} size`}
                    />
                  </Tooltip>
                </div>
                <Text id={descriptionId} type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block' }}>
                  {info.description}
                </Text>
              </div>
            </Radio>
          );
        })}
      </Space>
    </Radio.Group>
  );
});
