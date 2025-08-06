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

        // Direct main process console to Node terminal.
        electronApp.on("console", console.log);

        await use(electronApp);
        await electronApp.close();
    },

    page: async ({ electronApp }, use) => {
        // Wait for the document window to be initialized
        await electronApp.evaluate(async () => {
            return global.waitForDocumentWindowInitialization();
        });

        const page = await electronApp.firstWindow();

        // Direct renderer process console to Node terminal.
        page.on("console", console.log);

        await use(page);
    },
});

module.exports = { test };
