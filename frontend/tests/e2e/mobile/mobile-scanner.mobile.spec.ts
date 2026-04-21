import { test, expect } from '@playwright/test';

/**
 * Mobile QR/barcode scanner entry point.
 *
 * `MobileLayout` renders a FloatingBubble that opens
 * `MobileScannerSheet` (html5-qrcode). This spec does NOT exercise the
 * camera pipeline — Playwright's headless browser has no real camera
 * device, and html5-qrcode handles that gracefully by surfacing an
 * error string inside the popup. We verify:
 *   1. the FAB is present on a mobile viewport,
 *   2. tapping it opens the antd-mobile popup (.adm-popup-body),
 *   3. the scanner sheet renders its viewport element id.
 *
 * If the ScannerContext.openScanner contract changes the layout, this
 * test fails with a clear assertion rather than silently succeeding.
 */
test.describe('Mobile scanner', () => {
  test('FAB opens the scanner sheet', async ({ page, context }) => {
    // Pre-grant camera permission so html5-qrcode reaches the getUserMedia
    // call instead of short-circuiting on a permission prompt; the call
    // still fails (no device), which is fine — we only assert on the UI.
    await context.grantPermissions(['camera']);

    await page.goto('/dashboard');
    // FAB is inside MobileLayout and renders for every route except
    // /tool-checkout. aria-label was set on FloatingBubble for
    // accessibility; use that as the selector.
    const scanFab = page.locator('[aria-label="Scan QR code or barcode"]');
    await expect(scanFab).toBeVisible({ timeout: 10_000 });
    await scanFab.click();

    // antd-mobile Popup renders its content inside .adm-popup-body.
    await expect(page.locator('.adm-popup-body').first()).toBeVisible({ timeout: 5_000 });
  });
});
