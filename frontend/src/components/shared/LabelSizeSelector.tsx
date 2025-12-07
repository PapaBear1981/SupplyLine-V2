import { Radio, Space, Typography, Tooltip, theme } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { LabelSize } from '@/types/label';
import { LABEL_SIZE_INFO } from '@/types/label';

const { Text } = Typography;
const { useToken } = theme;

interface LabelSizeSelectorProps {
  value: LabelSize;
  onChange: (size: LabelSize) => void;
  disabled?: boolean;
}

/**
 * Label Size Selector Component
 *
 * Visual selector for choosing label size with helpful information
 * about each size option including dimensions, use cases, and field counts.
 */
export const LabelSizeSelector = ({ value, onChange, disabled = false }: LabelSizeSelectorProps) => {
  const { token } = useToken();

  return (
    <Radio.Group
      value={value}
      onChange={(e) => onChange(e.target.value as LabelSize)}
      disabled={disabled}
      style={{ width: '100%' }}
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {(Object.keys(LABEL_SIZE_INFO) as LabelSize[]).map((size) => {
          const info = LABEL_SIZE_INFO[size];
          const isSelected = value === size;

          return (
            <Radio
              key={size}
              value={size}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '12px',
                border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorder}`,
                borderRadius: token.borderRadius,
                background: isSelected ? token.colorPrimaryBg : token.colorBgContainer,
                transition: 'all 0.3s',
              }}
            >
              <div style={{ marginLeft: '8px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Text strong style={{ fontSize: '14px' }}>
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
                    <InfoCircleOutlined style={{ color: token.colorTextSecondary, fontSize: '12px' }} />
                  </Tooltip>
                </div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                  {info.description}
                </Text>
              </div>
            </Radio>
          );
        })}
      </Space>
    </Radio.Group>
  );
};
