import { test, expect } from '@playwright/test';

/**
 * Admin users management tab.
 *
 * The admin page at `/admin` is gated by `is_admin`; the setup project
 * logs in as ADMIN001, so the shared storageState grants access.
 * The Users tab key is 'users' — antd renders it as one of the Tabs.
 */
async function openUserManagementTab(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin');
  // The admin page renders antd Tabs with icon+label labels. Use the
  // accessible role+name selector so we match the tab regardless of
  // icon markup or overflow handling.
  const usersTab = page.getByRole('tab', { name: /user management/i });
  await expect(usersTab).toBeVisible({ timeout: 10_000 });
  await usersTab.click();
  // antd hides inactive tab panels with `display:none`, so we can't rely
  // on a visibility transition alone — wait for the tab to report it's
  // selected.
  await expect(usersTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
}

test.describe('Admin — Users (desktop)', () => {
  test('admin page reaches the users management section', async ({ page }) => {
    await openUserManagementTab(page);
    await expect(page.getByTestId('admin-users-section')).toBeVisible({ timeout: 10_000 });
  });

  test('Add User button opens the user drawer', async ({ page }) => {
    await openUserManagementTab(page);
    await expect(page.getByTestId('admin-users-create-button')).toBeVisible();
    await page.getByTestId('admin-users-create-button').click();
    await expect(page.locator('.ant-drawer-open, .ant-drawer-content').first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
