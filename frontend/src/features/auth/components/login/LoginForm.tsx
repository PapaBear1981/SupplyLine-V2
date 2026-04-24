import { Form, Button, Typography, message } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLoginMutation } from '../../services/authApi';
import { AnimatedInput } from '../shared/AnimatedInput';
import { formVariants, buttonHover, buttonTap } from '../../styles/animations';
import type { LoginRequest, LoginResponse } from '../../types';
import './LoginForm.css';

const { Title, Text } = Typography;

interface LoginFormProps {
  onSuccess: (response: LoginResponse) => void;
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [form] = Form.useForm();
  const [login, { isLoading }] = useLoginMutation();
  const handleSubmit = async (values: LoginRequest) => {
    try {
      const result = await login({
        employee_number: values.employee_number,
        password: values.password,
      }).unwrap();

      onSuccess(result);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as { status: number; data?: { error?: string } };
        message.error(
          apiError.data?.error || 'Login failed. Please check your credentials.'
        );
      } else {
        message.error('An unexpected error occurred');
      }
    }
  };

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="login-form-container"
      data-testid="login-form"
    >
      <div className="login-form-header">
        <div className="login-form-mark" aria-hidden="true">
          <ThunderboltFilled />
        </div>
        <Title level={2} className="login-form-title">
          Welcome back
        </Title>
        <Text type="secondary" className="login-form-subtitle">
          Sign in to resume dispatch, hangar ops, and crew coordination.
        </Text>
      </div>

      <Form
        form={form}
        name="login"
        onFinish={handleSubmit}
        autoComplete="off"
        layout="vertical"
        requiredMark={false}
        className="login-form"
      >
        <AnimatedInput
          name="employee_number"
          label="Employee Number"
          icon={<UserOutlined />}
          placeholder="e.g. 00421"
          autoFocus
          data-testid="login-username"
          rules={[
            { required: true, message: 'Please input your employee number!' },
          ]}
        />

        <AnimatedInput
          name="password"
          label="Password"
          type="password"
          icon={<LockOutlined />}
          placeholder="Enter your password"
          data-testid="login-password"
          rules={[
            { required: true, message: 'Please input your password!' },
          ]}
        />

        <div className="login-form-actions">
          <Link to="/forgot-password" className="forgot-password-link">
            Forgot password?
          </Link>
        </div>

        <Form.Item style={{ marginBottom: 0 }}>
          <motion.div whileHover={buttonHover} whileTap={buttonTap}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
              size="large"
              className="glass-button login-submit-button"
              data-testid="login-submit"
            >
              Log In
            </Button>
          </motion.div>
        </Form.Item>
      </Form>

      <div className="login-form-footer">
        <Text type="secondary" style={{ fontSize: '13px' }}>
          Need an account?{' '}
          <Button
            type="link"
            href="mailto:support@supplyline.aero?subject=Create%20my%20SupplyLine%20account"
            style={{ padding: 0, height: 'auto', fontSize: '13px' }}
          >
            Contact support
          </Button>
        </Text>
      </div>
    </motion.div>
  );
};
