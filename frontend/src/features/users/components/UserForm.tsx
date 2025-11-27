import { Button, Form, Input, Select, Space, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { Department, UserFormValues } from '../types';

interface UserFormProps {
  form: FormInstance<UserFormValues>;
  mode: 'create' | 'edit';
  departments?: Department[];
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export const UserForm = ({
  form,
  mode,
  departments,
  onSubmit,
  onCancel,
  submitting,
}: UserFormProps) => {
  const departmentOptions = (departments || []).map((dept) => ({
    label: dept.name,
    value: dept.name,
    disabled: !dept.is_active,
  }));

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
        label="Password"
        name="password"
        rules={
          mode === 'create'
            ? [{ required: true, message: 'Please set a password' }]
            : []
        }
        extra={mode === 'edit' ? 'Leave blank to keep the current password' : undefined}
      >
        <Input.Password placeholder={mode === 'create' ? 'Set a secure password' : 'Optional'} />
      </Form.Item>

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
