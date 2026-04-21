import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Mobile layout navigation — encapsulates the bottom TabBar and the
 * bottom-sheet "more" menu that the desktop sidebar collapses into on
 * viewports under 768px.
 */
export class MobileNavigation extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get tabDashboard(): Locator {
    return this.page.getByTestId('mobile-tab-dashboard');
  }

  get tabMenu(): Locator {
    return this.page.getByTestId('mobile-tab-menu');
  }

  get tabProfile(): Locator {
    return this.page.getByTestId('mobile-tab-profile');
  }

  get tabSettings(): Locator {
    return this.page.getByTestId('mobile-tab-settings');
  }

  get menuPopup(): Locator {
    return this.page.getByTestId('mobile-menu-popup');
  }

  get logoutItem(): Locator {
    return this.page.getByTestId('mobile-menu-logout');
  }

  menuItem(routeSlug: string): Locator {
    return this.page.getByTestId(`mobile-menu-item-${routeSlug}`);
  }

  async openMenu(): Promise<void> {
    await this.tabMenu.click();
    await this.menuPopup.waitFor({ state: 'visible' });
  }

  async goToMenuItem(routeSlug: string): Promise<void> {
    await this.openMenu();
    await this.menuItem(routeSlug).click();
  }
}
