// Signs every seeded role in once and saves its browser storage, so specs start signed in.
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { ACCOUNTS, stateFile, signIn, storageState } = require('./support/session');

for (const [role, email] of Object.entries(ACCOUNTS)) {
  test(`sign in as ${role}`, async ({ request }) => {
    fs.mkdirSync(path.dirname(stateFile(role)), { recursive: true });
    fs.writeFileSync(stateFile(role), JSON.stringify(storageState(await signIn(request, email))));
  });
}
