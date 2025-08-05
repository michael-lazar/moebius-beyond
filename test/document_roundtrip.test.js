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
                    const doc = require("../document/doc");

                    // Open the original file
                    await doc.open(testFile);

                    // Save to temp file
                    doc.file = tempFile;
                    await doc.save();

                    return { success: true };
                } catch (error) {
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
            throw new Error(`Test execution failed: ${result.error}\nStack: ${result.stack}`);
        }

        // Compare the original and saved bytes
        expect(fs.existsSync(tempFile)).toBe(true);
        const savedBytes = fs.readFileSync(tempFile);

        // Clean up temp file
        fs.unlinkSync(tempFile);

        function normalizeSauceDate(buffer) {
            // SAUCE record is always the last 128 bytes if present
            if (buffer.length < 128) return buffer;

            const sauceStart = buffer.length - 128;
            const sauceSignature = buffer.slice(sauceStart, sauceStart + 7).toString("ascii");

            // Only normalize if this is a valid SAUCE record
            if (sauceSignature !== "SAUCE00") return buffer;

            // Create a copy to avoid modifying the original
            const normalized = Buffer.from(buffer);

            // SAUCE date field is at bytes 82-89 within the SAUCE record
            const dateStart = sauceStart + 82;
            const dateEnd = dateStart + 8;

            // Replace date with placeholder
            normalized.fill(0x58, dateStart, dateEnd); // 0x58 = 'X'

            return normalized;
        }

        function hexDump(buffer, offset = 0) {
            let result = "";
            for (let i = 0; i < buffer.length; i += 16) {
                const addr = (offset + i).toString(16).padStart(8, "0");
                const chunk = buffer.slice(i, i + 16);
                const hex = Array.from(chunk)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join(" ")
                    .padEnd(48, " ");
                const ascii = Array.from(chunk)
                    .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
                    .join("");
                result += `${addr}: ${hex} |${ascii}|\n`;
            }
            return result.trim();
        }

        // Normalize SAUCE dates before comparison
        const normalizedOriginal = normalizeSauceDate(originalBytes);
        const normalizedSaved = normalizeSauceDate(savedBytes);

        // Compare as hex dumps for better diff visualization
        const originalHex = hexDump(normalizedOriginal);
        const savedHex = hexDump(normalizedSaved);

        expect(savedHex).toEqual(originalHex);
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
