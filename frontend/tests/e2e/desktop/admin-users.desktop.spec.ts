import { test, expect } from '@playwright/test';

/**
 * Admin users management tab.
 *
 * The admin page at `/admin` is gated by `is_admin`; the setup project
 * logs in as ADMIN001, so the shared storageState grants access.
 * The Users tab key is 'users' — antd renders it as one of the Tabs.
 */
test.describe('Admin — Users (desktop)', () => {
  test('admin page reaches the users management section', async ({ page }) => {
    await page.goto('/admin');
    // Click the Users tab; text match is stable for tab labels.
    const usersTab = page.locator('.ant-tabs-tab', { hasText: 'Users' }).first();
    if (await usersTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await usersTab.click();
    }
    await expect(page.getByTestId('admin-users-section')).toBeVisible({ timeout: 10_000 });
  });

  test('Add User button opens the user drawer', async ({ page }) => {
    await page.goto('/admin');
    const usersTab = page.locator('.ant-tabs-tab', { hasText: 'Users' }).first();
    if (await usersTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await usersTab.click();
    }
    await expect(page.getByTestId('admin-users-create-button')).toBeVisible();
    await page.getByTestId('admin-users-create-button').click();
    await expect(page.locator('.ant-drawer-open, .ant-drawer-content').first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
