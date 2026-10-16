// The hotel-wide "Ask AI" concierge staff open from any page: the floating panel on desktop and its
// typed chat with new chats and history. The concierge's server is faked (fakeConcierge).
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { shown, fakeConcierge, conciergeReply } = require('./helpers');

test.use({ storageState: authFile('staff') });

test.beforeEach(async ({ page }) => {
  await fakeConcierge(page);
  await page.goto('/hotels');
  await page.getByRole('button').filter({ has: page.getByTestId('SupportAgentIcon') }).last().click();
  await page.getByRole('button', { name: 'Prefer to type?' }).click();
});

test('starts a new chat and reopens an earlier one', async ({ page }) => {
  const box = page.getByPlaceholder('Type a message…');
  await box.fill('First question');
  await box.press('Enter');
  await expect(shown(page, conciergeReply('First question'))).toBeVisible();
  await page.getByTitle('New chat').click();
  await expect(shown(page, 'First question')).toBeHidden();

  await page.getByTitle('Recent chats').click();
  await shown(page, 'Earlier chat').click();
  await expect(page).toHaveURL(/chatId=1/);
});

test('switches back to voice', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to voice' }).click();
  await expect(page.getByRole('button', { name: 'Prefer to type?' })).toBeVisible();
});
