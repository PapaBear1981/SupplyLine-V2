import type { Page, Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Mobile chemicals list — the `ChemicalsPage` route component internally
 * swaps to `MobileChemicalsList` when `useIsMobile()` returns true
 * (viewport < 768px). Selectors target the mobile component's testids.
 */
export class MobileChemicalsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.page.getByTestId('mobile-chemicals-list');
  }

  get issuanceForm(): Locator {
    return this.page.getByTestId('mobile-chemicals-issuance-form');
  }

  get userTrigger(): Locator {
    return this.page.getByTestId('mobile-chemical-user-trigger');
  }

  get userSearch(): Locator {
    return this.page.getByTestId('mobile-chemical-user-search');
  }

  userOption(userId: number | string): Locator {
    return this.page.getByTestId(`mobile-chemical-user-option-${userId}`);
  }

  async open(): Promise<void> {
    await this.goto('/chemicals');
    await this.root.waitFor({ state: 'visible' });
  }

  /** Open the detail popup for a chemical by its part number text. */
  async openChemicalDetail(partNumber: string): Promise<void> {
    await this.page.locator(`text=${partNumber}`).first().click();
    await this.page.locator('.adm-popup-body').first().waitFor({ state: 'visible' });
  }

  /** Click the Issue Chemical button inside the currently open detail popup. */
  async clickIssueChemical(): Promise<void> {
    await this.page.getByRole('button', { name: 'Issue Chemical' }).click();
    await this.issuanceForm.waitFor({ state: 'visible', timeout: 5_000 });
  }
}
