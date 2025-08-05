const playwright = require("@playwright/test");
const { _electron } = require("playwright");

// Extend the base test with an Electron app fixture
const test = playwright.test.extend({
    // eslint-disable-next-line no-empty-pattern
    electronApp: async ({}, use) => {
        const electronApp = await _electron.launch({
            args: [".", "--no-splash"],
            cwd: process.cwd(),
            env: {
                ...process.env,
                ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
            },
        });
        await use(electronApp);
        await electronApp.close();
    },

    page: async ({ electronApp }, use) => {
        const page = await electronApp.firstWindow();
        // Direct Electron console to Node terminal.
        page.on("console", console.log);
        await use(page);
    },
});

module.exports = { test };
