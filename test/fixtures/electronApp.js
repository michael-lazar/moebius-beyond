const playwright = require("@playwright/test");
const { _electron } = require("playwright");

// Extend the base test with an Electron app fixture
const test = playwright.test.extend({
    // eslint-disable-next-line no-empty-pattern
    electronApp: async ({}, use) => {
        const electronApp = await _electron.launch({
            args: ["app/moebius.js"],
        });
        await use(electronApp);
        await electronApp.close();
    },

    page: async ({ electronApp }, use) => {
        const page = await electronApp.firstWindow();
        await use(page);
    },
});

module.exports = { test };
