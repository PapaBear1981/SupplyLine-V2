import { useState } from 'react';
import { Form, Button, Typography, Result } from 'antd';
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AnimatedInput } from '../components/shared/AnimatedInput';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { pageVariants, formVariants, buttonHover, buttonTap } from '../styles/animations';
import '../styles/glassmorphism.css';
import './ForgotPasswordPage.css';

const { Title, Text } = Typography;

export const ForgotPasswordPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState('');

  const onSubmit = async (values: { employee_number: string }) => {
    // TODO: Call API when backend email service is ready
    // await forgotPassword({ employee_number: values.employee_number });

    setEmployeeNumber(values.employee_number);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="forgot-password-page">
        <ThemeToggle />

        <div className="forgot-password-background">
          <div className="forgot-password-gradient" />
        </div>

        <div className="forgot-password-container">
          <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            className="glass-card forgot-password-card"
          >
            <Result
              status="success"
              title="Password Reset Requested"
              subTitle={
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    A password reset request has been submitted for employee number <strong>{employeeNumber}</strong>.
                  </Text>
                  <Text type="secondary" style={{ display: 'block' }}>
                    Please contact{' '}
                    <a href="mailto:support@supplyline.aero?subject=Password%20Reset%20Request">
                      support@supplyline.aero
                    </a>{' '}
                    to complete your password reset.
                  </Text>
                </div>
              }
              extra={
                <Link to="/login">
                  <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                    <Button
                      type="primary"
                      size="large"
                      className="glass-button"
                      icon={<ArrowLeftOutlined />}
                    >
                      Back to Login
                    </Button>
                  </motion.div>
                </Link>
              }
            />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <ThemeToggle />

      <div className="forgot-password-background">
        <div className="forgot-password-gradient" />
      </div>

      <div className="forgot-password-container">
        <motion.div
          variants={pageVariants}
          initial="initial"
          animate="animate"
          className="glass-card forgot-password-card"
        >
          <motion.div
            variants={formVariants}
            initial="hidden"
            animate="visible"
            className="forgot-password-form-container"
          >
            <div className="forgot-password-header">
              <Title level={2} style={{ marginBottom: 8 }}>
                Reset Password
              </Title>
              <Text type="secondary">
                Enter your employee number to request a password reset
              </Text>
            </div>

            <Form
              name="forgot-password"
              onFinish={onSubmit}
              autoComplete="off"
              layout="vertical"
              requiredMark={false}
              className="forgot-password-form"
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

              <Form.Item style={{ marginBottom: 16 }}>
                <motion.div whileHover={buttonHover} whileTap={buttonTap}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    size="large"
                    className="glass-button forgot-password-submit-button"
                  >
                    Request Password Reset
                  </Button>
                </motion.div>
              </Form.Item>

              <div className="forgot-password-back-link">
                <Link to="/login">
                  <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                  >
                    Back to Login
                  </Button>
                </Link>
              </div>
            </Form>

            <div className="forgot-password-footer">
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Note: Password reset via email is not yet available. Please contact support to reset your password.
              </Text>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
