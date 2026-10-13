// Rooms & Inventory (Rooms.js, ManageRooms.js): room types, rooms, inventory and availability per hotel.
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, fakeS3, PNG, successToast, tab } = require('./support/ui');
const { uniqueName, uniqueRoom, day } = require('./support/api');
const { SEEDED_HOTEL: HOTEL } = require('./support/session');

/** The row holding this text that has its own Edit and Delete buttons. */
const row = (page, text) =>
  page
    .locator('div')
    .filter({ hasText: text })
    .filter({ has: page.getByRole('button', { name: 'Delete' }) })
    .last();

/** Opens Rooms & Inventory on the seeded hotel. */
async function openRooms(page) {
  await page.goto('/rooms');
  await page.getByLabel('Hotel').fill('Radisson');
  await page.getByRole('option', { name: HOTEL }).click();
  await expect(page.getByText('Deluxe King').first()).toBeVisible();
}

/** Fills Add room type, without submitting. */
async function fillRoomType(page, name) {
  await page.getByRole('button', { name: '+ Add room type' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Max occupancy').fill('2');
  await dialog.getByLabel('Total rooms').fill('3');
  return dialog;
}

/** Opens the Inventory tab on Deluxe King, for nights far ahead so other tests' bookings are not touched. */
async function openInventory(page) {
  await openRooms(page);
  await tab(page, 'Inventory');
  await page.getByLabel('Room type').click();
  await page.getByRole('option', { name: 'Deluxe King' }).click();
  await page.getByLabel('From').fill(day(100));
  await page.getByLabel('To', { exact: true }).fill(day(101));
}

test.describe('staff rooms', () => {
  as('staff');

  test('asks for a hotel first', async ({ page }) => {
    await page.goto('/rooms');
    await expect(page.getByText('Pick a hotel to begin')).toBeVisible();
  });

  test('lists the room types and rooms of the hotel', async ({ page }) => {
    await openRooms(page);
    for (const name of ['Deluxe King', 'Twin Double', 'Executive Suite']) await expect(page.getByText(name).first()).toBeVisible();
    await tab(page, 'Rooms');
    await expect(page.getByText('101').first()).toBeVisible();
  });

  test('adds a room type with a perk and a photo, edits it, removes the photo, then deletes it', async ({ page }) => {
    await fakeS3(page);
    const name = uniqueName('Type');
    await openRooms(page);
    const dialog = await fillRoomType(page, name);
    await dialog.getByLabel('Perks').fill('Breakfast included');
    await dialog.getByLabel('Perks').press('Enter');
    await dialog.locator('input[type=file]').setInputFiles(PNG);
    await expect(dialog.getByText('Images (1/')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add room type' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();

    await row(page, name).getByRole('button', { name: 'Edit' }).click();
    await expect(dialog.getByText('Breakfast included')).toBeVisible();
    await dialog.getByRole('button', { name: '×' }).click();
    await expect(dialog.getByText('Images (0/')).toBeVisible();
    await dialog.getByLabel('Name').fill(`${name} Renamed`);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`${name} Renamed`).first()).toBeVisible();

    await row(page, `${name} Renamed`).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(`${name} Renamed`)).toHaveCount(0);
  });

  test('will not add a room type without its fields', async ({ page }) => {
    await openRooms(page);
    await page.getByRole('button', { name: '+ Add room type' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add room type' }).click();
    await expect(dialog).toBeVisible();
  });

  test('a refused room type shows the error', async ({ page }) => {
    await openRooms(page);
    await failApi(page, '/rooms/types$', 400, 'Room type name taken');
    const dialog = await fillRoomType(page, 'Taken');
    await dialog.getByRole('button', { name: 'Add room type' }).click();
    await toast(page, 'Room type name taken');
    await expect(dialog).toBeVisible();
  });

  test('adds a room, then puts it under maintenance', async ({ page }) => {
    const number = uniqueRoom();
    await openRooms(page);
    await tab(page, 'Rooms');
    await page.getByRole('button', { name: '+ Add room' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Room number').fill(number);
    await dialog.getByLabel('Room type').click();
    await page.getByRole('option', { name: 'Deluxe King' }).click();
    await dialog.getByRole('button', { name: 'Add room' }).click();
    await expect(page.getByText(number).first()).toBeVisible();

    await row(page, number).getByRole('button', { name: 'Edit' }).click();
    await dialog.getByLabel('Status').click();
    await page.getByRole('option', { name: 'Maintenance' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(row(page, number).getByText('Maintenance')).toBeVisible();
  });

  test('shows the nightly inventory and blocks rooms across a range', async ({ page }) => {
    await openInventory(page);
    await page.getByRole('button', { name: 'Show nights' }).click();
    await expect(page.getByText(day(100), { exact: true }).first()).toBeVisible();
    await page.getByLabel('Set blocked').fill('1');
    await page.getByRole('button', { name: 'Apply to range' }).click();
    await successToast(page);
  });

  test('a refused inventory change shows the error', async ({ page }) => {
    await openInventory(page);
    await failApi(page, '/rooms/inventory$', 400, 'Blocked exceeds total');
    await page.getByLabel('Set blocked').fill('999');
    await page.getByRole('button', { name: 'Apply to range' }).click();
    await toast(page, 'Blocked exceeds total');
  });

  test('finds room types with rooms free, and none when too many rooms are asked for', async ({ page }) => {
    await openRooms(page);
    await tab(page, 'Availability');
    await page.getByLabel('Check-in').fill(day(60));
    await page.getByLabel('Check-out').fill(day(61));
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('2 guests').first()).toBeVisible();
    await page.getByLabel('Rooms', { exact: true }).fill('999');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('2 guests')).toHaveCount(0);
  });
});
