import { useMemo } from 'react';
import { Button, Form, Input, Select, Space, Switch, Typography } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { Department, UserFormValues } from '../types';
import type { Warehouse } from '@features/warehouses/types';

const { Text } = Typography;

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'At least one uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'At least one lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'At least one digit (0-9)', test: (p) => /\d/.test(p) },
  { label: 'At least one special character (!@#$%^&*...)', test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p) },
];

interface PasswordRequirementsListProps {
  password: string;
}

const PasswordRequirementsList = ({ password }: PasswordRequirementsListProps) => {
  const requirements = useMemo(() => {
    return PASSWORD_REQUIREMENTS.map((req) => ({
      ...req,
      met: password ? req.test(password) : false,
    }));
  }, [password]);

  return (
    <div style={{ marginTop: 8 }}>
      {requirements.map((req, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {req.met ? (
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 12 }} />
          ) : (
            <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 12 }} />
          )}
          <Text
            style={{
              fontSize: 12,
              color: req.met ? '#52c41a' : '#ff4d4f',
            }}
          >
            {req.label}
          </Text>
        </div>
      ))}
    </div>
  );
};

interface UserFormProps {
  form: FormInstance<UserFormValues>;
  mode: 'create' | 'edit';
  departments?: Department[];
  warehouses?: Warehouse[];
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export const UserForm = ({
  form,
  mode,
  departments,
  warehouses,
  onSubmit,
  onCancel,
  submitting,
}: UserFormProps) => {
  const departmentOptions = (departments || []).map((dept) => ({
    label: dept.name,
    value: dept.name,
    disabled: !dept.is_active,
  }));

  const warehouseOptions = (warehouses || [])
    .filter((w) => w.is_active)
    .map((warehouse) => ({
      label: warehouse.name,
      value: warehouse.id,
    }));

  // Watch password field for real-time validation display
  const password = Form.useWatch('password', form) || '';

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={{
        is_admin: false,
        is_active: true,
      }}
    >
      <Form.Item
        label="Full Name"
        name="name"
        rules={[{ required: true, message: 'Please enter the user name' }]}
      >
        <Input placeholder="Jane Doe" />
      </Form.Item>

      <Form.Item
        label="Employee Number"
        name="employee_number"
        rules={[{ required: true, message: 'Please enter an employee number' }]}
      >
        <Input placeholder="EMP001" />
      </Form.Item>

      <Form.Item
        label="Department"
        name="department"
        rules={[{ required: true, message: 'Please select a department' }]}
      >
        <Select
          placeholder="Select department"
          options={departmentOptions}
          showSearch
          optionFilterProp="label"
          allowClear
        />
      </Form.Item>

      <Form.Item
        label="Email"
        name="email"
        rules={[{ type: 'email', message: 'Please enter a valid email' }]}
      >
        <Input placeholder="name@company.com" />
      </Form.Item>

      <Form.Item
        label="Assigned Warehouse"
        name="warehouse_id"
        tooltip="Assign this user to a warehouse to track their work location"
      >
        <Select
          placeholder="Select warehouse (optional)"
          options={warehouseOptions}
          showSearch
          optionFilterProp="label"
          allowClear
        />
      </Form.Item>

      <Form.Item
        label="Password"
        name="password"
        rules={
          mode === 'create'
            ? [
                { required: true, message: 'Please set a password' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const allMet = PASSWORD_REQUIREMENTS.every((req) => req.test(value));
                    if (allMet) return Promise.resolve();
                    return Promise.reject(new Error('Password does not meet all requirements'));
                  },
                },
              ]
            : [
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const allMet = PASSWORD_REQUIREMENTS.every((req) => req.test(value));
                    if (allMet) return Promise.resolve();
                    return Promise.reject(new Error('Password does not meet all requirements'));
                  },
                },
              ]
        }
      >
        <Input.Password placeholder={mode === 'create' ? 'Set a secure password' : 'Optional - leave blank to keep current'} />
      </Form.Item>

      {/* Show password requirements when creating or when editing with a password entered */}
      {(mode === 'create' || password) && (
        <div style={{ marginTop: -16, marginBottom: 16 }}>
          <PasswordRequirementsList password={password} />
        </div>
      )}

      <Form.Item label="Admin Access" name="is_admin" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item label="Active" name="is_active" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
          >
            {mode === 'create' ? 'Create User' : 'Save Changes'}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
