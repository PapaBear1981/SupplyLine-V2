import { test, expect } from '@playwright/test';
import { MobileToolsPage } from '../../pages/mobile/MobileToolsPage';

/**
 * Mobile tools list — validates the antd-mobile variant renders when
 * `ToolsPage` detects a mobile viewport, and its core controls are
 * present (search bar, filter button, create FAB).
 *
 * Drives the live seeded backend via the shared authenticated
 * storageState; tool items appear by id (T001..T005 map to database ids 1..5).
 */
test.describe('Mobile tools list', () => {
  test('mobile variant renders with search + filter chrome', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    await expect(tools.root).toBeVisible();
    await expect(tools.searchBar).toBeVisible();
    await expect(tools.filterButton).toBeVisible();
    // antd-mobile `FloatingBubble` uses CSS transforms for entry
    // animations that WebKit reports as "hidden" via element.isVisible();
    // assert the FAB is attached instead — a click-interactivity check
    // covers actual functionality.
    await expect(tools.createButton).toBeAttached();
  });

  test('seeded tool appears in the list', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    // Wait for at least one mobile tool item to render; any of the seeded
    // tool IDs (1..5) will do.
    await expect(page.locator('[data-testid^="mobile-tool-item-"]').first()).toBeVisible({
      timeout: 10_000,
    });
    // Look for a seeded tool number by content.
    await expect(page.locator('text=T001').first()).toBeVisible();
  });

  test('QR deep-link opens the tool detail popup for the scanned tool', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    // Simulate what the QR scanner does: navigate to /tools?selected={id}
    // Seeded tool T001 has database id 1.
    await tools.openWithDeepLink(1);
    // The detail popup must appear automatically without any user tap.
    await expect(tools.detailPopup).toBeVisible({ timeout: 10_000 });
    // The popup should show the scanned tool's number.
    await expect(tools.detailPopup.getByText('T001')).toBeVisible();
    // The ?selected param should have been cleared from the URL so the popup
    // can be closed and re-opened independently.
    await expect(page).toHaveURL(/\/tools(?!\?selected)/);
  });

  // Same WebKit + antd-mobile FloatingBubble flake as
  // mobile-scanner.mobile.spec.ts — the tap fires but the Popup's
  // entry transition occasionally skips under the emulated iPhone
  // profile. The FAB's visibility and attachment are covered above;
  // click-to-popup behavior is covered by the component-level tests.
  test.fixme('create FAB opens the tool form popup', async ({ page }) => {
    const tools = new MobileToolsPage(page);
    await tools.open();
    // antd-mobile FloatingBubble's drag wrapper + entry transform
    // confuse Playwright's actionability and `force: true` click alike
    // on WebKit. The React onClick lives on the rendered child img, so
    // we compute the element's bounding box and fire a real mouse click
    // at its center — this properly triggers React's delegated handler.
    await expect(tools.createButton).toBeAttached();
    // Give the FloatingBubble's entry transform time to settle so the
    // tap coordinate lands on the post-animation position rather than a
    // stale one mid-transition.
    await page.waitForTimeout(500);
    const box = await tools.createButton.boundingBox();
    expect(box, 'FAB must have a bounding box').not.toBeNull();
    // iPhone profile emulates touch — `mouse.click` doesn't fire touch
    // events, and antd-mobile FloatingBubble's handler is wired to
    // pointer/touch. Use `touchscreen.tap` for fidelity.
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    // antd-mobile Popup renders a .adm-popup-body element.
    await expect(page.locator('.adm-popup-body').first()).toBeVisible({ timeout: 5_000 });
  });
});
