const { test } = require("./fixtures/electronApp");
const { expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

test.describe("Document Loading", () => {
    const testDataDir = path.join(__dirname, "data");

    async function loadDocument(page, filename) {
        const testFile = path.join(testDataDir, filename);
        expect(fs.existsSync(testFile)).toBe(true);

        const result = await page.evaluate(
            async ({ filename, testDataDir }) => {
                try {
                    const path = require("path");
                    const doc = require("../document/doc");

                    const filePath = path.join(testDataDir, filename);
                    await doc.open(filePath);

                    return {
                        success: true,
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
                } catch (error) {
                    return {
                        success: false,
                        error: error.message || error.toString(),
                    };
                }
            },
            { filename, testDataDir }
        );

        expect(result.success).toBe(true);
        return result;
    }

    test("should load ct-hobbes.ans with correct values", async ({ page }) => {
        const result = await loadDocument(page, "ct-hobbes.ans");

        expect(result.columns).toBe(80);
        expect(result.rows).toBe(70);
        expect(result.title.trim()).toBe("Zoomies");
        expect(result.author.trim()).toBe("Cthulu");
        expect(result.group.trim()).toBe("Mistigris");
        expect(result.font_name).toBe("IBM VGA");
        expect(result.use_9px_font).toBe(false);
        expect(result.ice_colors).toBe(false);
        expect(result.dataLength).toBe(5600);
        expect(result.paletteLength).toBe(16);
    });

    test("should load darokin-david.asc with correct values", async ({ page }) => {
        const result = await loadDocument(page, "darokin-david.asc");

        expect(result.columns).toBe(80);
        expect(result.rows).toBe(40);
        expect(result.title.trim()).toBe("DAVID");
        expect(result.author.trim()).toBe("darokin");
        expect(result.group.trim()).toBe("Mistigris");
        expect(result.font_name).toBe("IBM VGA");
        expect(result.use_9px_font).toBe(false);
        expect(result.ice_colors).toBe(false);
        expect(result.dataLength).toBe(3200);
        expect(result.paletteLength).toBe(16);
    });

    test("should load file_id.diz with correct values", async ({ page }) => {
        const result = await loadDocument(page, "file_id.diz");

        expect(result.columns).toBe(80);
        expect(result.rows).toBe(25);
        expect(result.title.trim()).toBe("");
        expect(result.author.trim()).toBe("");
        expect(result.group.trim()).toBe("");
        expect(result.font_name).toBe("Default");
        expect(result.use_9px_font).toBe(false);
        expect(result.ice_colors).toBe(false);
        expect(result.dataLength).toBe(2000);
        expect(result.paletteLength).toBe(16);
    });

    test("should load goo-unrein.bin with correct values", async ({ page }) => {
        const result = await loadDocument(page, "goo-unrein.bin");

        expect(result.columns).toBe(300);
        expect(result.rows).toBe(49);
        expect(result.title.trim()).toBe("IMPURE");
        expect(result.author.trim()).toBe("GOO");
        expect(result.group.trim()).toBe("67");
        expect(result.font_name).toBe("IBM VGA");
        expect(result.use_9px_font).toBe(false);
        expect(result.ice_colors).toBe(true);
        expect(result.dataLength).toBe(14700);
        expect(result.paletteLength).toBe(16);
    });

    test("should load hermanas.nfo with correct values", async ({ page }) => {
        const result = await loadDocument(page, "hermanas.nfo");

        expect(result.columns).toBe(160);
        expect(result.rows).toBe(124);
        expect(result.title.trim()).toBe("HPM#002");
        expect(result.author.trim()).toBe("Mr.R0b070");
        expect(result.group.trim()).toBe("HPM");
        expect(result.font_name).toBe("IBM VGA");
        expect(result.use_9px_font).toBe(false);
        expect(result.ice_colors).toBe(true);
        expect(result.dataLength).toBe(19840);
        expect(result.paletteLength).toBe(16);
    });

    test("should load mozz-night-moon.xb with correct values", async ({ page }) => {
        const result = await loadDocument(page, "mozz-night-moon.xb");

        expect(result.columns).toBe(80);
        expect(result.rows).toBe(26);
        expect(result.title.trim()).toBe("Moonlit lake");
        expect(result.author.trim()).toBe("mozz");
        expect(result.group.trim()).toBe("mistigris");
        expect(result.font_name).toBe("Custom");
        expect(result.use_9px_font).toBe(false);
        expect(result.ice_colors).toBe(true);
        expect(result.dataLength).toBe(2080);
        expect(result.paletteLength).toBe(16);
    });
});
