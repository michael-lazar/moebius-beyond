const { test } = require("./fixtures/electronApp");
const { expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

test.describe("UI Reference Image", () => {
    const testDataDir = path.join(__dirname, "data");

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
