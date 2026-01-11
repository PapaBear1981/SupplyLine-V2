import { Outlet } from 'react-router-dom';
import './MobileAuthLayout.css';

/**
 * Minimal mobile auth layout that renders child routes without any wrapper
 * The individual auth pages (LoginPage, ForgotPasswordPage) handle their own mobile layout
 */
export const MobileAuthLayout = () => {
  return <Outlet />;
};
