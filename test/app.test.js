const { test, expect } = require('@playwright/test');
const { _electron } = require('playwright');

test('hello world - electron app launches', async () => {
  // Launch the Electron app
  const electronApp = await _electron.launch({
    args: ['app/moebius.js']
  });

  // Get the first window
  const page = await electronApp.firstWindow();

  // Verify the app launched successfully
  expect(page).toBeTruthy();

  // Close the app
  await electronApp.close();
});