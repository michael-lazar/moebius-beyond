const playwright = require("@playwright/test");
const { _electron } = require("playwright");

// Extend the base test with an Electron app fixture
const test = playwright.test.extend({
    electronApp: async ({}, use) => { // eslint-disable-line no-empty-pattern
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
