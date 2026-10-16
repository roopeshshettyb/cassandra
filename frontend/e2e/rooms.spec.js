// Rooms & Inventory: room types, physical rooms, the nightly inventory and the availability search.
// Every seeded hotel has Deluxe King (101+), Twin Double (201+) and Executive Suite (301+).
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, unique, shown, rowWith: row, day, stubS3, failApi, file, PNG } = require('./helpers');

const HOTEL = 'The Lodhi';
const ROOM_PHOTO = file('room.png', 'image/png', PNG);

/** Opens Rooms & Inventory for the hotel, on the given tab. */
async function openRooms(page, tab = 'Room types') {
  await page.goto('/rooms');
  await page.getByLabel('Hotel').fill(HOTEL);
  await page.getByRole('option', { name: HOTEL, exact: true }).click();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

/** On the Inventory tab: shows the nights of this room type over the date range. */
async function showNights(page, roomType, from, to) {
  await page.getByLabel('Room type').click();
  await page.getByRole('option', { name: roomType }).click();
  await page.getByLabel('From', { exact: true }).fill(from);
  await page.getByLabel('To', { exact: true }).fill(to);
  await page.getByRole('button', { name: 'Show nights' }).click();
}

/** A room number no seeded room or other test (in any browser) uses: seeded rooms are three digits. */
const newRoomNumber = () => String(100000 + Math.floor(Math.random() * 900000));

/** Adds a Deluxe King room with this number. */
async function addRoom(page, roomNumber) {
  await page.getByRole('button', { name: '+ Add room' }).click();
  await page.getByRole('dialog').getByLabel('Room number').fill(roomNumber);
  await page.getByRole('dialog').getByLabel('Room type').click();
  await page.getByRole('option', { name: 'Deluxe King', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add room' }).click();
}

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('asks for a hotel first', async ({ page }) => {
    await page.goto('/rooms');
    await expect(page.getByText('Pick a hotel to begin')).toBeVisible();
  });

  test('lists the hotel room types', async ({ page }) => {
    await openRooms(page);
    for (const name of ['Deluxe King', 'Twin Double', 'Executive Suite']) await expect(shown(page, name)).toBeVisible();
  });

  test('edits a room type with a perk and a photo, then deletes it', async ({ page }) => {
    await stubS3(page);
    const name = unique('E2E Suite');
    await openRooms(page);
    await page.getByRole('button', { name: '+ Add room type' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Max occupancy').fill('2');
    await dialog.getByLabel('Total rooms').fill('0');
    await dialog.getByRole('button', { name: 'Add room type' }).click();
    await expect(dialog).toBeHidden();

    await row(page, name).getByRole('button', { name: 'Edit' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Perks').fill('Sea view');
    await dialog.getByLabel('Perks').press('Enter');
    await expect(dialog.getByRole('button', { name: 'Sea view' })).toBeVisible();
    await dialog.locator('input[type=file]').setInputFiles(ROOM_PHOTO);
    await expect(dialog.locator('img')).toHaveCount(1);
    await dialog.getByLabel('Max occupancy').fill('3');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, name)).toContainText('3');

    await row(page, name).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(shown(page, name)).toBeHidden();
  });

  test('reports a room type photo that fails to upload', async ({ page }) => {
    await stubS3(page, { status: 500 });
    await openRooms(page);
    await row(page, 'Deluxe King').getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles(ROOM_PHOTO);
    await expect(toast(page, 'Image upload failed')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('cancel leaves the room types unchanged', async ({ page }) => {
    const name = unique('E2E Cancelled Type');
    await openRooms(page);
    await page.getByRole('button', { name: '+ Add room type' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill(name);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test('adds a room, then deletes it', async ({ page }) => {
    const roomNumber = newRoomNumber();
    await openRooms(page, 'Rooms');
    await addRoom(page, roomNumber);
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(shown(page, roomNumber)).toBeVisible();

    await row(page, roomNumber).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(shown(page, roomNumber)).toBeHidden();
  });

  test('puts a room under maintenance', async ({ page }) => {
    const roomNumber = newRoomNumber();
    await openRooms(page, 'Rooms');
    await addRoom(page, roomNumber);
    await row(page, roomNumber).getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Status').click();
    await page.getByRole('option', { name: 'Maintenance' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, roomNumber)).toContainText('Maintenance');
  });

  test('refuses a room number the hotel already has', async ({ page }) => {
    await openRooms(page, 'Rooms');
    await addRoom(page, '101');
    await expect(toast(page, 'Room 101 already exists at this hotel')).toBeVisible();
  });

  test('shows the nightly inventory', async ({ page }) => {
    await openRooms(page, 'Inventory');
    await showNights(page, 'Deluxe King', day(1), day(3));
    await expect(page.getByRole('button', { name: 'Apply to range' })).toBeVisible();
  });

  test('blocks rooms across a date range', async ({ page }) => {
    await openRooms(page, 'Inventory');
    await showNights(page, 'Executive Suite', day(200), day(201));
    await page.getByLabel('Set blocked').fill('1');
    await page.getByRole('button', { name: 'Apply to range' }).click();
    await expect(page.getByLabel('Set blocked')).toHaveValue('');
  });

  test('reports an inventory change the backend refuses, and keeps the entry', async ({ page }) => {
    await failApi(page, '/rooms/inventory$', 'More rooms blocked than exist', { method: 'PATCH' });
    await openRooms(page, 'Inventory');
    await showNights(page, 'Twin Double', day(210), day(211));
    await page.getByLabel('Set blocked').fill('99');
    await page.getByRole('button', { name: 'Apply to range' }).click();
    await expect(toast(page, 'More rooms blocked than exist')).toBeVisible();
    await expect(page.getByLabel('Set blocked')).toHaveValue('99');
  });

  test('asks for a room type before applying inventory', async ({ page }) => {
    await openRooms(page, 'Inventory');
    await page.getByRole('button', { name: 'Apply to range' }).click();
    await expect(toast(page, 'Pick a room type first')).toBeVisible();
  });

  test('finds room types free for a stay', async ({ page }) => {
    await openRooms(page, 'Availability');
    await page.getByLabel('Check-in').fill(day(30));
    await page.getByLabel('Check-out').fill(day(32));
    await page.getByLabel('Guests', { exact: true }).fill('2');
    await page.getByLabel('Rooms', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(shown(page, 'Deluxe King')).toBeVisible();
  });
});

test.describe('staff', () => {
  test.use({ storageState: authFile('staff') });

  test('can manage rooms', async ({ page }) => {
    await page.goto('/rooms');
    await page.getByLabel('Hotel').click();
    await page.getByRole('option').first().click();
    await expect(page.getByRole('button', { name: '+ Add room type' })).toBeVisible();
  });
});
