import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Mobile tools list — the `ToolsPage` route component internally swaps to
 * `MobileToolsList` when `useIsMobile()` returns true (viewport < 768px).
 * Selectors target the mobile component's testids, not the desktop ones.
 */
export class MobileToolsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('mobile-tools-list');
  }

  get searchBar(): Locator {
    return this.page.getByTestId('mobile-tools-search');
  }

  get filterButton(): Locator {
    return this.page.getByTestId('mobile-tools-filter-button');
  }

  get createButton(): Locator {
    return this.page.getByTestId('mobile-tools-create-button');
  }

  get detailPopup(): Locator {
    return this.page.getByTestId('mobile-tool-detail-popup');
  }

  get editButton(): Locator {
    return this.page.getByTestId('mobile-tool-edit-button');
  }

  get formPopup(): Locator {
    return this.page.getByTestId('mobile-tool-form-popup');
  }

  toolItem(id: number | string): Locator {
    return this.page.getByTestId(`mobile-tool-item-${id}`);
  }

  async open(): Promise<void> {
    await this.goto('/tools');
    await this.root.waitFor({ state: 'visible' });
  }

  async openWithDeepLink(toolId: number): Promise<void> {
    await this.goto(`/tools?selected=${toolId}`);
    await this.root.waitFor({ state: 'visible' });
  }
}
