const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./test",
    timeout: 30000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "list",
    use: {
        trace: "on-first-retry",
    },
});
