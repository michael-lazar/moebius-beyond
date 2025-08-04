const { test } = require("../fixtures/electronApp");

test.describe("Textmode Class", () => {
    test("should initialize without errors", async ({ page }) => {
        await page.evaluate(() => {
            const { Textmode } = require("./app/libtextmode/textmode.js");
            new Textmode();
        });
    });
});
