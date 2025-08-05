const { test } = require("./fixtures/electronApp");
const { expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

test.describe("Document Round Trip Tests", () => {
    const testDataDir = path.join(__dirname, "data");

    async function performRoundTripTest(page, filename) {
        const testFile = path.join(testDataDir, filename);
        const tempFile = path.join(testDataDir, `temp_${filename}`);

        expect(fs.existsSync(testFile)).toBe(true);

        const originalBytes = fs.readFileSync(testFile);

        const result = await page.evaluate(
            async ({ testFile, tempFile }) => {
                try {
                    console.log("Starting round trip test for:", testFile);
                    const doc = require("../document/doc.js");

                    console.log("TextModeDoc singleton loaded:", typeof doc);

                    // Open the original file
                    console.log("Opening file:", testFile);
                    await doc.open(testFile);
                    console.log("File opened successfully");

                    // Save to temp file
                    console.log("Setting file to:", tempFile);
                    doc.file = tempFile;
                    console.log("Saving file...");
                    await doc.save();
                    console.log("File saved successfully");

                    return { success: true };
                } catch (error) {
                    console.log("Error occurred:", error);
                    return {
                        success: false,
                        error: error.message || error.toString(),
                        stack: error.stack,
                    };
                }
            },
            { testFile, tempFile }
        );

        if (!result.success) {
            console.log("Test failed with error:", result.error);
            console.log("Stack:", result.stack);
        }
        expect(result.success).toBe(true);

        // Compare the original and saved bytes
        expect(fs.existsSync(tempFile)).toBe(true);
        const savedBytes = fs.readFileSync(tempFile);

        // Clean up temp file
        fs.unlinkSync(tempFile);

        expect(savedBytes).toEqual(originalBytes);
    }

    test("should produce identical bytes for round trip of ct-hobbes.ans", async ({ page }) => {
        await performRoundTripTest(page, "ct-hobbes.ans");
    });

    test("should produce identical bytes for round trip of darokin-david.asc", async ({ page }) => {
        await performRoundTripTest(page, "darokin-david.asc");
    });

    test("should produce identical bytes for round trip of file_id.diz", async ({ page }) => {
        await performRoundTripTest(page, "file_id.diz");
    });

    test("should produce identical bytes for round trip of goo-unrein.bin", async ({ page }) => {
        await performRoundTripTest(page, "goo-unrein.bin");
    });

    test("should produce identical bytes for round trip of hermanas.nfo", async ({ page }) => {
        await performRoundTripTest(page, "hermanas.nfo");
    });

    test("should produce identical bytes for round trip of mozz-night-moon.xb", async ({
        page,
    }) => {
        await performRoundTripTest(page, "mozz-night-moon.xb");
    });
});
