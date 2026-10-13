// The concierge staff open from any page (App.js, GuestConcierge.js). The test servers have no model
// key (support/env.js), so every message is answered with an error.
const { test, expect } = require('@playwright/test');
const { as, errorToast } = require('./support/ui');

test.describe('staff concierge', () => {
  as('staff');

  /** Opens the concierge panel with its floating button. */
  async function openConcierge(page) {
    await page.goto('/dashboard');
    await page
      .getByRole('button')
      .filter({ has: page.getByTestId('SupportAgentIcon') })
      .last()
      .click();
    await expect(page.getByText('Your Concierge')).toBeVisible();
  }

  test('the floating button opens the concierge, and a click outside closes it', async ({ page }) => {
    await openConcierge(page);
    await page.getByText('Last 24 hours').click();
    await expect(page.getByText('Your Concierge')).toHaveCount(0);
  });

  test('switches to text, shows the message, reports the failure, and switches back to voice', async ({ page }) => {
    await openConcierge(page);
    await page.getByTestId('ChatBubbleOutlineIcon').click();
    const box = page.getByPlaceholder('Type a message…');
    await box.fill('How many guests are checked in?');
    await box.press('Enter');
    await expect(page.getByText('How many guests are checked in?').first()).toBeVisible();
    await errorToast(page, { timeout: 30000 });
    await page.getByTitle('Switch to voice').click();
    await expect(page.getByText('Your Concierge')).toBeVisible();
  });
});
