const { test } = require("./fixtures/electronApp");
const { expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

test.describe("Document Load and Save Tests", () => {
    const testDataDir = path.join(__dirname, "data");

    async function performLoadAndSaveTest(page, filename, expectedValues) {
        const testFile = path.join(testDataDir, filename);
        const tempFile = path.join(testDataDir, `temp_${filename}`);

        expect(fs.existsSync(testFile)).toBe(true);

        // Read original file for later comparison
        const originalBytes = fs.readFileSync(testFile);

        const result = await page.evaluate(
            async ({ testFile, tempFile, testDataDir, filename }) => {
                try {
                    const path = require("path");
                    const doc = require("../document/doc");

                    // 1. Load the file
                    const filePath = path.join(testDataDir, filename);
                    await doc.open(filePath);

                    // 2. Get document properties for verification
                    const loadResult = {
                        columns: doc.columns,
                        rows: doc.rows,
                        title: doc.title,
                        author: doc.author,
                        group: doc.group,
                        font_name: doc.font_name,
                        use_9px_font: doc.use_9px_font,
                        ice_colors: doc.ice_colors,
                        dataLength: doc.data.length,
                        paletteLength: doc.palette.length,
                    };

                    // 3. Save the file
                    doc.file = tempFile;
                    await doc.save();

                    return {
                        success: true,
                        loadResult,
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message || error.toString(),
                        stack: error.stack,
                    };
                }
            },
            { testFile, tempFile, testDataDir, filename }
        );

        // Verify load was successful
        expect(result.success).toBe(true);

        // 2. Verify the document is loaded with the correct values
        const loadResult = result.loadResult;
        expect(loadResult.columns).toBe(expectedValues.columns);
        expect(loadResult.rows).toBe(expectedValues.rows);
        expect(loadResult.title.trim()).toBe(expectedValues.title);
        expect(loadResult.author.trim()).toBe(expectedValues.author);
        expect(loadResult.group.trim()).toBe(expectedValues.group);
        expect(loadResult.font_name).toBe(expectedValues.font_name);
        expect(loadResult.use_9px_font).toBe(expectedValues.use_9px_font);
        expect(loadResult.ice_colors).toBe(expectedValues.ice_colors);
        expect(loadResult.dataLength).toBe(expectedValues.dataLength);
        expect(loadResult.paletteLength).toBe(expectedValues.paletteLength);

        // 4. Verify the bytes match (with special handling for different formats)
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

        function normalizeJsonTimestamps(buffer, filename) {
            // Only normalize MBXD files (JSON format)
            if (!filename.endsWith(".mbxd")) return buffer;

            const jsonString = buffer.toString("utf8");
            const jsonObj = JSON.parse(jsonString);

            // Normalize timestamps to fixed values for comparison
            if (jsonObj.metadata) {
                jsonObj.metadata.created = "2025-01-01T00:00:00.000Z";
                jsonObj.metadata.modified = "2025-01-01T00:00:00.000Z";
            }

            return Buffer.from(JSON.stringify(jsonObj, null, 2), "utf8");
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

        // Normalize files before comparison
        const normalizedOriginal = normalizeJsonTimestamps(
            normalizeSauceDate(originalBytes),
            filename
        );
        const normalizedSaved = normalizeJsonTimestamps(normalizeSauceDate(savedBytes), filename);

        // Compare as hex dumps for better diff visualization
        const originalHex = hexDump(normalizedOriginal);
        const savedHex = hexDump(normalizedSaved);

        expect(savedHex).toEqual(originalHex);
    }

    test("ct-hobbes.ans: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "ct-hobbes.ans", {
            columns: 80,
            rows: 70,
            title: "Zoomies",
            author: "Cthulu",
            group: "Mistigris",
            font_name: "IBM VGA",
            use_9px_font: false,
            ice_colors: false,
            dataLength: 5600,
            paletteLength: 16,
        });
    });

    test("darokin-david.asc: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "darokin-david.asc", {
            columns: 80,
            rows: 40,
            title: "DAVID",
            author: "darokin",
            group: "Mistigris",
            font_name: "IBM VGA",
            use_9px_font: false,
            ice_colors: false,
            dataLength: 3200,
            paletteLength: 16,
        });
    });

    test("file_id.diz: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "file_id.diz", {
            columns: 80,
            rows: 25,
            title: "",
            author: "",
            group: "",
            font_name: "Default",
            use_9px_font: false,
            ice_colors: false,
            dataLength: 2000,
            paletteLength: 16,
        });
    });

    test("goo-unrein.bin: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "goo-unrein.bin", {
            columns: 300,
            rows: 49,
            title: "IMPURE",
            author: "GOO",
            group: "67",
            font_name: "IBM VGA",
            use_9px_font: false,
            ice_colors: true,
            dataLength: 14700,
            paletteLength: 16,
        });
    });

    test("hermanas.nfo: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "hermanas.nfo", {
            columns: 160,
            rows: 124,
            title: "HPM#002",
            author: "Mr.R0b070",
            group: "HPM",
            font_name: "IBM VGA",
            use_9px_font: false,
            ice_colors: true,
            dataLength: 19840,
            paletteLength: 16,
        });
    });

    test("mozz-night-moon.xb: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "mozz-night-moon.xb", {
            columns: 80,
            rows: 26,
            title: "Moonlit lake",
            author: "mozz",
            group: "mistigris",
            font_name: "Custom",
            use_9px_font: false,
            ice_colors: true,
            dataLength: 2080,
            paletteLength: 16,
        });
    });

    test("birds-blue.mbxd: load, verify, save, and verify bytes match", async ({ page }) => {
        await performLoadAndSaveTest(page, "birds-blue.mbxd", {
            columns: 60,
            rows: 18,
            title: "Birds",
            author: "mozz",
            group: "mistigris",
            font_name: "MOZZ4",
            use_9px_font: true,
            ice_colors: true,
            dataLength: 1080, // 60 * 18
            paletteLength: 16,
        });
    });
});
