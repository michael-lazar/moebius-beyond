const { test } = require("../../fixtures/electronApp");
const { expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

test.describe("Document Class", () => {
    const testDataDir = path.join(__dirname, "../../data");

    async function loadDocument(page, filename) {
        const testFile = path.join(testDataDir, filename);
        expect(fs.existsSync(testFile)).toBe(true);

        const result = await page.evaluate(
            async ({ filename, testDataDir }) => {
                try {
                    const path = require("path");
                    const libtextmode = require("../libtextmode/libtextmode.js");

                    const filePath = path.join(testDataDir, filename);
                    const doc = await libtextmode.read_file(filePath);

                    return {
                        success: true,
                        ...doc, // Spread the whole doc object
                        dataLength: doc.data.length,
                        paletteLength: doc.palette_array.length,
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

    test("should open PNG as reference image", async ({ page }) => {
        const testFile = path.join(testDataDir, "icon.png");
        expect(fs.existsSync(testFile)).toBe(true);

        // Wait for the document page to be fully loaded
        await page.waitForSelector("#reference_image", { state: "attached", timeout: 10000 });

        const result = await page.evaluate(
            async ({ testFile }) => {
                try {
                    // Import the ui module and call open_reference_image with our test file
                    const { open_reference_image } = require("../document/ui/ui.js");

                    // Call the function with our test PNG file
                    open_reference_image({ file: testFile });

                    // Check that the reference image was set up correctly
                    const referenceImage = document.getElementById("reference_image");
                    const referenceOpacityValue =
                        document.getElementById("reference_opacity_value");
                    const referenceSizeValue = document.getElementById("reference_size_value");
                    const referenceAngleValue = document.getElementById("reference_angle_value");

                    return {
                        success: true,
                        hasImageSource:
                            referenceImage && referenceImage.src && referenceImage.src.length > 0,
                        isNotClosed: referenceImage && !referenceImage.classList.contains("closed"),
                        opacityValue: referenceOpacityValue ? referenceOpacityValue.value : null,
                        sizeValue: referenceSizeValue ? referenceSizeValue.value : null,
                        angleValue: referenceAngleValue ? referenceAngleValue.value : null,
                        imageTop: referenceImage ? referenceImage.style.top : null,
                        imageLeft: referenceImage ? referenceImage.style.left : null,
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message || error.toString(),
                    };
                }
            },
            { testFile }
        );

        if (!result.success) {
            console.log("PNG reference image test error:", result.error);
        }
        expect(result.success).toBe(true);
        expect(result.hasImageSource).toBe(true);
        expect(result.isNotClosed).toBe(true);
        expect(result.opacityValue).toBe("40");
        expect(result.angleValue).toBe("0");
        expect(result.imageTop).toBe("0px");
        expect(result.imageLeft).toBe("0px");
    });
});
