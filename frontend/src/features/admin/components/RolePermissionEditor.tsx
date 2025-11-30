import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Tree,
  Button,
  Space,
  Spin,
  Alert,
  Input,
  Tag,
  Typography,
  message,
  Tooltip,
} from 'antd';
import type { TreeProps } from 'antd';
import { SearchOutlined, LockOutlined, SaveOutlined } from '@ant-design/icons';
import {
  useGetPermissionCategoriesQuery,
  useGetRoleWithPermissionsQuery,
  useUpdateRolePermissionsMutation,
} from '../services/permissionsApi';
import type { Permission, PermissionCategory } from '@features/users/types';

const { Text } = Typography;

interface RolePermissionEditorProps {
  roleId: number | null;
  roleName: string;
  isSystemRole?: boolean;
  open: boolean;
  onClose: () => void;
}

export const RolePermissionEditor: React.FC<RolePermissionEditorProps> = ({
  roleId,
  roleName,
  isSystemRole = false,
  open,
  onClose,
}) => {
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const { data: categories, isLoading: categoriesLoading } = useGetPermissionCategoriesQuery();
  const { data: roleWithPermissions, isLoading: roleLoading } = useGetRoleWithPermissionsQuery(
    roleId || 0,
    { skip: !roleId }
  );
  const [updatePermissions, { isLoading: isUpdating }] = useUpdateRolePermissionsMutation();

  // Build tree data from categories
  const treeData = useMemo(() => {
    if (!categories) return [];

    return categories.map((category: PermissionCategory) => ({
      title: (
        <Text strong>
          {category.name} <Tag color="blue">{category.count}</Tag>
        </Text>
      ),
      key: `category-${category.name}`,
      children: category.permissions.map((perm: Permission) => ({
        title: (
          <Space>
            <Text>{perm.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {perm.description}
            </Text>
          </Space>
        ),
        key: `perm-${perm.id}`,
        permissionId: perm.id,
        permissionName: perm.name,
        searchText: `${perm.name} ${perm.description}`.toLowerCase(),
      })),
    }));
  }, [categories]);

  // Filter tree data based on search
  const filteredTreeData = useMemo(() => {
    if (!searchValue) return treeData;

    const searchLower = searchValue.toLowerCase();
    return treeData
      .map((category) => ({
        ...category,
        children: category.children.filter((perm: { searchText: string }) =>
          perm.searchText.includes(searchLower)
        ),
      }))
      .filter((category) => category.children.length > 0);
  }, [treeData, searchValue]);

  // Get all category keys for expand/collapse all
  const allCategoryKeys = useMemo(() => {
    return treeData.map((category) => category.key);
  }, [treeData]);

  // Compute expanded keys based on search value (derived state, no effect needed)
  const computedExpandedKeys = useMemo(() => {
    if (searchValue) {
      return filteredTreeData.map((c) => c.key);
    }
    return expandedKeys;
  }, [searchValue, filteredTreeData, expandedKeys]);

  // Initialize checked keys when role permissions load from API
  // This is a legitimate use case for syncing external data to local state
  useEffect(() => {
    if (roleWithPermissions?.permissions) {
      const permIds = roleWithPermissions.permissions.map((p: Permission) => `perm-${p.id}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheckedKeys(permIds);
    }
  }, [roleWithPermissions]);

  // Expand all categories when searching
  useEffect(() => {
    if (searchValue) {
      const matchingCategories = filteredTreeData.map((c) => c.key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedKeys(matchingCategories);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoExpandParent(true);
    }
  }, [searchValue, filteredTreeData]);

  const handleCheck: TreeProps['onCheck'] = (checked) => {
    if (Array.isArray(checked)) {
      setCheckedKeys(checked);
    } else {
      setCheckedKeys(checked.checked);
    }
  };

  const handleExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
    setAutoExpandParent(false);
  };

  const handleSave = async () => {
    if (!roleId) return;

    // Extract permission IDs from checked keys
    const permissionIds = checkedKeys
      .filter((key) => String(key).startsWith('perm-'))
      .map((key) => parseInt(String(key).replace('perm-', ''), 10));

    try {
      await updatePermissions({
        roleId,
        permissions: permissionIds,
      }).unwrap();
      message.success('Permissions updated successfully');
      onClose();
    } catch {
      message.error('Failed to update permissions');
    }
  };

  const handleSelectAll = () => {
    const allPermKeys = treeData.flatMap((category) =>
      category.children.map((perm: { key: string }) => perm.key)
    );
    setCheckedKeys(allPermKeys);
  };

  const handleClearAll = () => {
    setCheckedKeys([]);
  };

  const handleExpandAll = () => {
    setExpandedKeys(allCategoryKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const isLoading = categoriesLoading || roleLoading;

  // Count selected permissions
  const selectedCount = checkedKeys.filter((key) => String(key).startsWith('perm-')).length;
  const totalCount = treeData.reduce((acc, cat) => acc + cat.children.length, 0);

  return (
    <Modal
      title={
        <Space>
          <span>Edit Permissions: {roleName}</span>
          {isSystemRole && (
            <Tooltip title="System roles have their name and description protected, but permissions can be modified">
              <Tag color="blue" icon={<LockOutlined />}>
                System Role
              </Tag>
            </Tooltip>
          )}
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={isUpdating}
        >
          Save Changes
        </Button>,
      ]}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Alert
            message={
              <Space>
                <Text>
                  Selected: <Text strong>{selectedCount}</Text> of {totalCount} permissions
                </Text>
              </Space>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
            <Input
              placeholder="Search permissions..."
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              allowClear
            />
            <Space>
              <Button size="small" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" onClick={handleClearAll}>
                Clear All
              </Button>
              <Button size="small" onClick={handleExpandAll}>
                Expand All
              </Button>
              <Button size="small" onClick={handleCollapseAll}>
                Collapse All
              </Button>
            </Space>
          </Space>

          <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
            {filteredTreeData.length > 0 ? (
              <Tree
                checkable
                checkedKeys={checkedKeys}
                expandedKeys={expandedKeys}
                autoExpandParent={autoExpandParent}
                onCheck={handleCheck}
                onExpand={handleExpand}
                treeData={filteredTreeData}
                selectable={false}
              />
            ) : (
              <Text type="secondary" style={{ padding: 16, display: 'block', textAlign: 'center' }}>
                No permissions found matching "{searchValue}"
              </Text>
            )}
          </div>
        </>
      )}
    </Modal>
  );
};

export default RolePermissionEditor;
