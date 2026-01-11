import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

/**
 * Minimal auth layout that renders child routes without any wrapper
 * The individual auth pages (LoginPage, ForgotPasswordPage) handle their own layout
 */
export const AuthLayout = () => {
  return <Outlet />;
};
