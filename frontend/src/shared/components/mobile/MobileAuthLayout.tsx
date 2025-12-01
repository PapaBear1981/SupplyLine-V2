import { Outlet } from 'react-router-dom';
import { SafeArea } from 'antd-mobile';
import './MobileAuthLayout.css';

/**
 * Mobile-optimized layout for authentication pages
 */
export const MobileAuthLayout = () => {
  return (
    <div className="mobile-auth-layout">
      <SafeArea position="top" />
      <div className="mobile-auth-header">
        <div className="mobile-auth-logo">SupplyLine</div>
        <div className="mobile-auth-subtitle">Aerial Firefighting MRO</div>
      </div>
      <div className="mobile-auth-content">
        <Outlet />
      </div>
      <div className="mobile-auth-footer">
        <span className="mobile-auth-footer-text">
          Secure login with role-based access
        </span>
      </div>
      <SafeArea position="bottom" />
    </div>
  );
};
