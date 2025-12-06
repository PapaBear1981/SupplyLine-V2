/**
 * HotkeyHelp - Modal component displaying all available keyboard shortcuts
 */

import React, { useMemo } from 'react';
import { Modal, Typography, Row, Col, Divider, Tag, Space, Tooltip } from 'antd';
import { KeyboardOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useHotkeyContext } from '../../contexts/HotkeyContext';
import {
  GLOBAL_HOTKEYS,
  HOTKEY_CATEGORIES,
  formatHotkey,
  getHotkeysByCategory,
} from '../../constants/hotkeys';
import type { HotkeyDefinition, HotkeyCategory } from '../../constants/hotkeys';
import './HotkeyHelp.scss';

const { Title, Text } = Typography;

interface HotkeyItemProps {
  hotkey: HotkeyDefinition;
}

function HotkeyItem({ hotkey }: HotkeyItemProps) {
  const formattedKey = formatHotkey(hotkey);
  const keys = formattedKey.split('+');

  return (
    <div className="hotkey-item">
      <Text className="hotkey-description">{hotkey.description}</Text>
      <Space size={2} className="hotkey-keys">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            <Tag className="hotkey-key">{key}</Tag>
            {index < keys.length - 1 && <Text type="secondary">+</Text>}
          </React.Fragment>
        ))}
      </Space>
    </div>
  );
}

interface HotkeyCategoryGroupProps {
  category: HotkeyCategory;
  hotkeys: HotkeyDefinition[];
}

function HotkeyCategoryGroup({ category, hotkeys }: HotkeyCategoryGroupProps) {
  if (hotkeys.length === 0) return null;

  const categoryInfo = HOTKEY_CATEGORIES[category];

  return (
    <div className="hotkey-category">
      <Title level={5} className="category-title">
        {categoryInfo.label}
      </Title>
      <div className="hotkey-list">
        {hotkeys.map((hotkey) => (
          <HotkeyItem key={hotkey.id} hotkey={hotkey} />
        ))}
      </div>
    </div>
  );
}

export function HotkeyHelp() {
  const { helpVisible, hideHelp, getAllHotkeys, activeScope } = useHotkeyContext();

  // Get all hotkeys grouped by category
  const groupedHotkeys = useMemo(() => {
    const allHotkeys = getAllHotkeys();
    const hotkeyMap: Record<string, HotkeyDefinition> = {};

    // Build a map to avoid duplicates
    allHotkeys.forEach((hotkey) => {
      hotkeyMap[hotkey.id] = hotkey;
    });

    return getHotkeysByCategory(hotkeyMap);
  }, [getAllHotkeys]);

  // Sort categories by order
  const sortedCategories = useMemo(() => {
    return (Object.keys(HOTKEY_CATEGORIES) as HotkeyCategory[]).sort(
      (a, b) => HOTKEY_CATEGORIES[a].order - HOTKEY_CATEGORIES[b].order
    );
  }, []);

  return (
    <Modal
      open={helpVisible}
      onCancel={hideHelp}
      footer={null}
      title={
        <Space>
          <KeyboardOutlined />
          <span>Keyboard Shortcuts</span>
        </Space>
      }
      width={700}
      className="hotkey-help-modal"
      centered
    >
      <div className="hotkey-help-content">
        <div className="hotkey-help-header">
          <Space>
            <InfoCircleOutlined />
            <Text type="secondary">
              Press <Tag>Shift</Tag>+<Tag>?</Tag> or <Tag>F1</Tag> anytime to show this help
            </Text>
          </Space>
          {activeScope !== 'global' && (
            <div className="active-scope">
              <Text type="secondary">
                Current page: <Tag color="blue">{activeScope}</Tag>
              </Text>
            </div>
          )}
        </div>

        <Divider />

        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            {sortedCategories.slice(0, 3).map((category) => (
              <HotkeyCategoryGroup
                key={category}
                category={category}
                hotkeys={groupedHotkeys[category]}
              />
            ))}
          </Col>
          <Col xs={24} md={12}>
            {sortedCategories.slice(3).map((category) => (
              <HotkeyCategoryGroup
                key={category}
                category={category}
                hotkeys={groupedHotkeys[category]}
              />
            ))}
          </Col>
        </Row>

        <Divider />

        <div className="hotkey-help-footer">
          <Text type="secondary">
            <Tooltip title="Some shortcuts may vary based on your current page context">
              <InfoCircleOutlined /> Context-aware shortcuts
            </Tooltip>
            {' '}&bull;{' '}
            Shortcuts work everywhere except in text input fields
          </Text>
        </div>
      </div>
    </Modal>
  );
}

export default HotkeyHelp;
