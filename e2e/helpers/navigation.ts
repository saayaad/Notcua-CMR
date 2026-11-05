import { expect, type Page } from '@playwright/test';

/** Selects a main-view navigation item in either the pinned menu or its grouped drawer. */
export async function clickNavigation(page: Page, name: string) {
  const pinned = page.getByRole('button', { name, exact: true }).first();
  if (await pinned.isVisible().catch(() => false)) {
    await pinned.click();
    return;
  }

  const groupedMenu = page.locator('details.nav-more');
  await expect(groupedMenu).toBeAttached();
  if (!(await groupedMenu.evaluate((element) => (element as HTMLDetailsElement).open)))
    await groupedMenu.locator('summary').click();
  await groupedMenu.getByRole('button', { name, exact: true }).click();
}
