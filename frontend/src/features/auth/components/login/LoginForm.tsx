import { useEffect } from 'react';
import { Form, Checkbox, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLoginMutation } from '../../services/authApi';
import { useRememberMe } from '../../hooks/useRememberMe';
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
  const { savedEmployeeNumber, saveEmployeeNumber, clearRememberMe } = useRememberMe();

  // Pre-fill employee number and remember me checkbox if saved
  useEffect(() => {
    if (savedEmployeeNumber) {
      form.setFieldsValue({
        employee_number: savedEmployeeNumber,
        remember_me: true
      });
    }
  }, [savedEmployeeNumber, form]);

  const handleSubmit = async (values: LoginRequest & { remember_me?: boolean }) => {
    try {
      const result = await login({
        employee_number: values.employee_number,
        password: values.password,
      }).unwrap();

      // Handle remember me
      if (values.remember_me) {
        saveEmployeeNumber(values.employee_number);
      } else {
        clearRememberMe();
      }

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
    >
      <div className="login-form-header">
        <Title level={2} style={{ marginBottom: 8 }}>
          Welcome back
        </Title>
        <Text type="secondary">
          Continue where you left off—dispatching drops, monitoring hangars, and coordinating crews.
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
          rules={[
            { required: true, message: 'Please input your password!' },
          ]}
        />

        <div className="login-form-actions">
          <Form.Item name="remember_me" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Remember me
              </Text>
            </Checkbox>
          </Form.Item>

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
