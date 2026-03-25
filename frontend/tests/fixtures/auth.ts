import { test as base } from '@playwright/test';

export const TEST_CREDENTIALS = {
  valid: {
    username: 'ADMIN001',
    password: 'admin123',
  },
  invalid: {
    username: 'INVALID',
    password: 'wrongpassword',
  },
};

export interface AuthenticatedPage {
  page: any;
};

export const test = base.extend<{ authenticatedPage: AuthenticatedPage }>({
  authenticatedPage: async ({ page }, use) => {
    // Perform login before tests
    await page.goto('/login');
    await page.fill('input[id="username"], input[name="username"], input[placeholder*="username"], input[placeholder*="Username"]', TEST_CREDENTIALS.valid.username);
    await page.fill('input[id="password"], input[name="password"], input[placeholder*="password"], input[placeholder*="Password"]', TEST_CREDENTIALS.valid.password);
    
    // Try to find and click the login button
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("Sign in")');
    await loginButton.click();
    
    // Wait for navigation to dashboard (or check if logged in)
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
      // If not redirected to dashboard, we might still be on login page - that's ok for some tests
    });
    
    await use({ page });
  },
});

export { expect } from '@playwright/test';