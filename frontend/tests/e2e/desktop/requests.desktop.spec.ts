import { test, expect } from '@playwright/test';
import { requestsOn } from '../utils/feature-flags';

test.skip(!requestsOn, 'Requests feature is deactivated');

/**
 * Requests dashboard smoke coverage.
 *
 * The page now splits into Active Requests / History tabs so closed requests
 * (fulfilled / cancelled) don't crowd the work-in-progress view. The tests
 * below pin the new tab structure and the existing create-request CTA.
 */
test.describe('Requests (desktop)', () => {
  test('requests dashboard renders with its create CTA', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.getByTestId('requests-page')).toBeVisible();
    await expect(page.getByTestId('requests-create-button')).toBeVisible();
  });

  test('exposes Active Requests and History tabs', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.getByRole('tab', { name: /Active Requests/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('tab', { name: /History/i })).toBeVisible();
  });

  test('History tab swaps the search placeholder to scope the view to closed requests', async ({
    page,
  }) => {
    await page.goto('/requests');
    const historyTab = page.getByRole('tab', { name: /History/i });
    await historyTab.click();
    await expect(historyTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
    // `destroyInactiveTabPane` removes the inactive pane, but `.first()` keeps
    // this resilient if the dashboard ever toggles that prop off.
    await expect(
      page.getByPlaceholder(/search request history/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar auto-expands the Operations group when landing on the requests page', async ({ page }) => {
    await page.goto('/requests');
    await expect(page.getByTestId('nav-operations')).toBeVisible();
    await expect(page.getByTestId('nav-requests')).toBeVisible();
  });

  test('New Request navigates to the create form route', async ({ page }) => {
    await page.goto('/requests');
    await page.getByTestId('requests-create-button').click();
    await expect(page).toHaveURL(/\/requests\/new/);
  });
});
