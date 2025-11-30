import { useState, useMemo } from 'react';
import {
  Table,
  Tag,
  Space,
  Input,
  Select,
  Typography,
  Spin,
  Alert,
  Card,
  Statistic,
  Row,
  Col,
  Tooltip,
  Badge,
} from 'antd';
import type { TableProps } from 'antd';
import {
  SearchOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import {
  useGetPermissionCategoriesQuery,
  useGetPermissionMatrixQuery,
} from '../services/permissionsApi';
import type { Permission, PermissionCategory } from '@features/users/types';

const { Text } = Typography;

export const PermissionOverview: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const { data: categories, isLoading: categoriesLoading } = useGetPermissionCategoriesQuery();
  const { data: matrix, isLoading: matrixLoading } = useGetPermissionMatrixQuery();

  const isLoading = categoriesLoading || matrixLoading;

  // Filter permissions based on search and category
  const filteredPermissions = useMemo(() => {
    if (!categories) return [];

    let permissions: (Permission & { categoryName: string })[] = [];

    categories.forEach((category: PermissionCategory) => {
      category.permissions.forEach((perm: Permission) => {
        permissions.push({
          ...perm,
          categoryName: category.name,
        });
      });
    });

    if (selectedCategory) {
      permissions = permissions.filter((p) => p.categoryName === selectedCategory);
    }

    if (searchValue) {
      const search = searchValue.toLowerCase();
      permissions = permissions.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search)
      );
    }

    return permissions;
  }, [categories, searchValue, selectedCategory]);

  // Category options for select
  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    return categories.map((cat: PermissionCategory) => ({
      label: `${cat.name} (${cat.count})`,
      value: cat.name,
    }));
  }, [categories]);

  // Statistics
  const stats = useMemo(() => {
    if (!categories || !matrix) return { totalPermissions: 0, totalRoles: 0, totalCategories: 0 };
    return {
      totalPermissions: categories.reduce((acc: number, cat: PermissionCategory) => acc + cat.count, 0),
      totalRoles: matrix.roles.length,
      totalCategories: categories.length,
    };
  }, [categories, matrix]);

  // Build columns for the matrix view
  const matrixColumns: TableProps<Permission & { categoryName: string }>['columns'] = useMemo(() => {
    if (!matrix) return [];

    const baseColumns: TableProps<Permission & { categoryName: string }>['columns'] = [
      {
        title: 'Permission',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: 200,
        render: (name: string, record) => (
          <Space direction="vertical" size={0}>
            <Text strong code>
              {name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          </Space>
        ),
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: 'Category',
        dataIndex: 'categoryName',
        key: 'categoryName',
        width: 150,
        render: (category: string) => <Tag color="blue">{category}</Tag>,
        filters: categoryOptions.map((opt) => ({ text: opt.label, value: opt.value })),
        onFilter: (value, record) => record.categoryName === value,
      },
    ];

    // Add columns for each role
    const roleColumns: TableProps<Permission & { categoryName: string }>['columns'] = matrix.roles.map((role) => ({
      title: (
        <Tooltip title={role.description || role.name}>
          <Space>
            <TeamOutlined />
            <Text ellipsis style={{ maxWidth: 80 }}>
              {role.name}
            </Text>
            {role.is_system_role && (
              <Badge status="processing" />
            )}
          </Space>
        </Tooltip>
      ),
      key: `role-${role.id}`,
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: Permission) => {
        const hasPermission = matrix.assignments[role.id]?.includes(record.id);
        return hasPermission ? (
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
        ) : (
          <CloseCircleFilled style={{ color: '#d9d9d9', fontSize: 16 }} />
        );
      },
    }));

    return [...baseColumns, ...roleColumns];
  }, [matrix, categoryOptions]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Alert
        message="Permission Overview"
        description="View all permissions and their assignment to roles. Use this dashboard to understand the current permission structure and identify gaps."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Permissions"
              value={stats.totalPermissions}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Roles"
              value={stats.totalRoles}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Permission Categories"
              value={stats.totalCategories}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="Search permissions..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          style={{ width: 250 }}
        />
        <Select
          placeholder="Filter by category"
          value={selectedCategory}
          onChange={setSelectedCategory}
          allowClear
          options={categoryOptions}
          style={{ width: 200 }}
        />
      </Space>

      {/* Permission Matrix */}
      <Table
        columns={matrixColumns}
        dataSource={filteredPermissions}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `${total} permissions`,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
      />
    </div>
  );
};

export default PermissionOverview;
