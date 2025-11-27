import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../services/authApi';
import { useAppDispatch } from '@app/hooks';
import { setCredentials } from '../slices/authSlice';
import { ROUTES } from '@shared/constants/routes';
import type { LoginRequest } from '../types';

export const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const handleSubmit = async (values: LoginRequest) => {
    try {
      const result = await login(values).unwrap();
      dispatch(setCredentials({ user: result.user, token: result.access_token }));
      message.success('Login successful!');
      navigate(ROUTES.DASHBOARD);
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
    <Form
      name="login"
      onFinish={handleSubmit}
      autoComplete="off"
      size="large"
    >
      <Form.Item
        name="employee_number"
        rules={[
          { required: true, message: 'Please input your employee number!' },
        ]}
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="Employee Number"
          autoFocus
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[{ required: true, message: 'Please input your password!' }]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="Password"
        />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={isLoading}
          block
        >
          Log In
        </Button>
      </Form.Item>
    </Form>
  );
};
