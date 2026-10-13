// Manage Costs (ManageCosts.js): open to admins and owners only.
const { test, expect } = require('@playwright/test');
const { as, toast, failApi } = require('./support/ui');

for (const role of ['admin', 'owner']) {
  test.describe(`${role} costs`, () => {
    as(role);

    test('shows the AI usage costs', async ({ page }) => {
      await page.goto('/costs');
      await expect(page.getByText('Aggregated AI usage costs per booking').or(page.getByText('No cost data available')).first()).toBeAttached();
      await expect(page.getByText('You are not authorized to view this page.')).toHaveCount(0);
    });
  });
}

test.describe('costs errors', () => {
  as('admin');

  test('costs that fail to load show the error', async ({ page }) => {
    await failApi(page, '/costs/aggregate$', 500, 'Costs unavailable');
    await page.goto('/costs');
    await toast(page, 'Costs unavailable');
  });
});

test.describe('staff costs', () => {
  as('staff');

  test('refuses the page, and never asks the backend', async ({ page }) => {
    let asked = false;
    page.on('request', (r) => {
      if (r.url().includes('/costs/aggregate')) asked = true;
    });
    await page.goto('/costs');
    await expect(page.getByText('You are not authorized to view this page.')).toBeVisible();
    expect(asked).toBe(false);
  });
});
