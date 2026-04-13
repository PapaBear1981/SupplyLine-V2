import { useState } from 'react';
import { Tag, List, SpinLoading } from 'antd-mobile';
import {
  UserOutlined,
  TeamOutlined,
  NotificationOutlined,
  ApartmentOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { RightOutline as AdmRightOutline } from 'antd-mobile-icons';
import { useMobileAdminEnabled } from '@shared/hooks/useMobileAdminEnabled';
import { useAppSelector } from '@app/hooks';
import {
  MobilePageScaffold,
  MobileSectionCard,
  MobileDetailHeader,
} from '@shared/components/mobile';
import { DesktopOnlyMessage } from '@shared/components/mobile/DesktopOnlyMessage';
import { MobileUsersList } from './MobileUsersList';
import { MobileAnnouncementsList } from './MobileAnnouncementsList';
import './MobileAdminPage.css';

type AdminSection = 'home' | 'users' | 'announcements';
type AvailableSection = Extract<AdminSection, 'users' | 'announcements'>;

const adminSections: Array<{
  key: AvailableSection;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    key: 'users',
    title: 'User Management',
    description: 'View users, unlock accounts, reset passwords',
    icon: <UserOutlined />,
    color: '#1890ff',
  },
  {
    key: 'announcements',
    title: 'Announcements',
    description: 'Post announcements to all users',
    icon: <NotificationOutlined />,
    color: '#722ed1',
  },
];

const desktopOnlySections = [
  {
    title: 'Role Management',
    description: 'Create and edit roles',
    icon: <TeamOutlined />,
  },
  {
    title: 'Departments',
    description: 'Manage department list',
    icon: <ApartmentOutlined />,
  },
  {
    title: 'AI Settings',
    description: 'Provider, model, API key',
    icon: <RobotOutlined />,
  },
  {
    title: 'System Settings',
    description: 'Session timeout, mobile toggle, etc.',
    icon: <SettingOutlined />,
  },
];

/**
 * Mobile admin hub. Gated twice:
 *  1. useMobileAdminEnabled() — the system-wide toggle an admin can
 *     flip from desktop System Settings (Phase 5.1)
 *  2. user.is_admin — only actual admins see anything here
 *
 * Non-admins / disabled toggles see a DesktopOnlyMessage that tells
 * them the admin panel is either off system-wide or desktop-only
 * for their account.
 */
export const MobileAdminPage = () => {
  const user = useAppSelector((state) => state.auth.user);
  const {
    isEnabled: mobileAdminEnabled,
    isLoading: mobileAdminLoading,
    isError: mobileAdminError,
  } = useMobileAdminEnabled();
  const [section, setSection] = useState<AdminSection>('home');

  const isAdmin = Boolean(user?.is_admin);

  if (!isAdmin) {
    return (
      <DesktopOnlyMessage
        title="Admin access required"
        description="This page is only available to admin users."
      />
    );
  }

  // Wait for the mobile_admin_enabled query to resolve before deciding
  // whether to show the "disabled" message. Without this, admin users
  // would briefly see a "Mobile Admin Disabled" flash on first load
  // even when the setting is actually on.
  if (mobileAdminLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <SpinLoading />
      </div>
    );
  }

  if (mobileAdminError) {
    return (
      <DesktopOnlyMessage
        title="Couldn't load mobile admin settings"
        description="Please refresh the page to try again. If the problem persists, use the desktop admin panel."
      />
    );
  }

  if (!mobileAdminEnabled) {
    return (
      <DesktopOnlyMessage
        title="Mobile Admin Disabled"
        description="Mobile admin access is currently turned off. An admin can enable it from the desktop System Settings page."
      />
    );
  }

  if (section === 'users') {
    return <MobileUsersList onBack={() => setSection('home')} />;
  }

  if (section === 'announcements') {
    return <MobileAnnouncementsList onBack={() => setSection('home')} />;
  }

  return (
    <MobilePageScaffold
      header={
        <MobileDetailHeader
          title="Admin Panel"
          subtitle="Mobile-friendly admin actions"
        />
      }
    >
      <MobileSectionCard title="Available on mobile" flush>
        <List>
          {adminSections.map((item) => (
            <List.Item
              key={item.key}
              prefix={
                <div
                  className="mobile-admin__icon"
                  style={{
                    background: `${item.color}22`,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
              }
              description={item.description}
              arrow={<AdmRightOutline />}
              onClick={() => setSection(item.key)}
            >
              {item.title}
            </List.Item>
          ))}
        </List>
      </MobileSectionCard>

      <MobileSectionCard title="Desktop only" flush>
        <List>
          {desktopOnlySections.map((item) => (
            <List.Item
              key={item.title}
              prefix={
                <div
                  className="mobile-admin__icon"
                  style={{
                    background: 'var(--adm-color-fill-content)',
                    color: 'var(--adm-color-weak)',
                  }}
                >
                  {item.icon}
                </div>
              }
              description={item.description}
              extra={<Tag fill="outline">Desktop</Tag>}
            >
              {item.title}
            </List.Item>
          ))}
        </List>
      </MobileSectionCard>

      <div
        style={{
          padding: 16,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--adm-color-weak)',
          lineHeight: 1.5,
        }}
      >
        For full system administration — role/permission editing, system
        settings, AI configuration — use the desktop app. Mobile admin is
        intentionally limited to safe-on-a-phone operations.
      </div>
    </MobilePageScaffold>
  );
};
