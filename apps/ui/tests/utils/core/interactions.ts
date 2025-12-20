import { Page } from '@playwright/test';
import { getByTestId, getButtonByText } from './elements';

/**
 * Get the platform-specific modifier key (Meta for Mac, Control for Windows/Linux)
 * This is used for keyboard shortcuts like Cmd+Enter or Ctrl+Enter
 */
export function getPlatformModifier(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

/**
 * Press the platform-specific modifier + a key (e.g., Cmd+Enter or Ctrl+Enter)
 */
export async function pressModifierEnter(page: Page): Promise<void> {
  const modifier = getPlatformModifier();
  await page.keyboard.press(`${modifier}+Enter`);
}

/**
 * Click an element by its data-testid attribute
 */
export async function clickElement(page: Page, testId: string): Promise<void> {
  const element = await getByTestId(page, testId);
  await element.click();
}

/**
 * Click a button by its text content
 */
export async function clickButtonByText(
  page: Page,
  text: string
): Promise<void> {
  const button = await getButtonByText(page, text);
  await button.click();
}

/**
 * Fill an input field by its data-testid attribute
 */
export async function fillInput(
  page: Page,
  testId: string,
  value: string
): Promise<void> {
  const input = await getByTestId(page, testId);
  await input.fill(value);
}

/**
 * Press a keyboard shortcut key
 */
export async function pressShortcut(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

/**
 * Press a number key (0-9) on the keyboard
 */
export async function pressNumberKey(page: Page, num: number): Promise<void> {
  await page.keyboard.press(num.toString());
}

/**
 * Focus on an input element to test that shortcuts don't fire when typing
 */
export async function focusOnInput(page: Page, testId: string): Promise<void> {
  const input = page.locator(`[data-testid="${testId}"]`);
  await input.focus();
}

/**
 * Close any open dialog by pressing Escape
 * Waits for dialog to be removed from DOM rather than using arbitrary timeout
 */
export async function closeDialogWithEscape(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  // Wait for any dialog overlay to disappear
  await page
    .locator('[data-radix-dialog-overlay], [role="dialog"]')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {
      // Dialog may have already closed or not exist
    });
}
