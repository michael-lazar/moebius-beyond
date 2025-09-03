const { white, bright_white, palette_4bit, rgb_to_hex } = require("./palette");
const { create_canvas, clone_canvas } = require("./canvas");
const { lookup_url } = require("./font_lookup");

function generate_font_canvas(bitmask, height, length) {
    const { canvas, ctx, image_data } = create_canvas(8 * length, height);
    const rgba = new Uint8Array([255, 255, 255, 255]);
    for (let i = 0, y = 0, char = 0; i < bitmask.length; i++) {
        for (let x = 0, byte = bitmask[i]; x < 8; x++) {
            if ((byte >> x) & 1) {
                image_data.data.set(rgba, (y * canvas.width + (8 - 1 - x) + char * 8) * 4);
            }
        }
        if ((i + 1) % height === 0) {
            y = 0;
            char++;
        } else {
            y++;
        }
    }
    ctx.putImageData(image_data, 0, 0);
    return canvas;
}

function add_ninth_bit_to_canvas(canvas, length) {
    const { canvas: new_canvas, ctx } = create_canvas(9 * length, canvas.height);
    for (let char = 0; char < length; char++) {
        ctx.drawImage(canvas, char * 8, 0, 8, canvas.height, char * 9, 0, 8, canvas.height);
        if (char >= 0xc0 && char <= 0xdf) {
            ctx.drawImage(
                canvas,
                char * 8 + 8 - 1,
                0,
                1,
                canvas.height,
                char * 9 + 8,
                0,
                1,
                canvas.height
            );
        }
    }
    return new_canvas;
}

function coloured_glyphs(source_canvas, rgb) {
    const { canvas, ctx } = clone_canvas(source_canvas);

    ctx.fillStyle = rgb_to_hex(rgb);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return canvas;
}

let cached_backgrounds = {};
function coloured_background(font_width, height, rgb) {
    const hex = rgb_to_hex(rgb);
    const key = hex;
    if (cached_backgrounds[key]) return cached_backgrounds[key];

    const { canvas, ctx } = create_canvas(font_width, height);
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    cached_backgrounds[key] = canvas;
    return canvas;
}

let cached_glyphs = {};
function create_coloured_glyph(source_canvas, code, rgb, font_width, height) {
    const hex = rgb_to_hex(rgb);
    const key = [hex, code].join("|");
    if (cached_glyphs[key]) return cached_glyphs[key];

    const { canvas, ctx } = create_canvas(font_width, height);
    const image_data = source_canvas
        .getContext("2d")
        .getImageData(code * font_width, 0, font_width, height);
    ctx.putImageData(image_data, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    cached_glyphs[key] = canvas;
    return canvas;
}

class Font {
    /** @type {App.Color[]} */
    palette;
    /** @type {string} */
    name;
    /** @type {number} */
    height;
    /** @type {Uint8Array} */
    bitmask;
    /** @type {number} */
    width;
    /** @type {number} */
    length;
    /** @type {boolean} */
    use_9px_font;
    /** @type {HTMLCanvasElement} */
    canvas;
    /** @type {HTMLCanvasElement[]} */
    glyphs;
    /** @type {HTMLCanvasElement[]} */
    backgrounds;
    /** @type {HTMLCanvasElement} */
    cursor;

    /**
     * @param {App.Color[]} [palette]
     */
    constructor(palette = [...palette_4bit]) {
        this.palette = palette;
    }

    /**
     * @param {object} options
     * @param {string} [options.name]
     * @param {Uint8Array} [options.bytes]
     * @param {boolean} [options.use_9px_font]
     * @returns {Promise<void>}
     */
    async load({ name = "IBM VGA", bytes, use_9px_font = false }) {
        if (bytes) {
            //If we load XBIN, we check the font from the XBIN file so we don't need to load a font
            if (this.name) {
                this.name = name;
            } else {
                this.name = "XBIN font";
            }
        } else {
            //In case of ans or other non-xbin file, we load the font by its name
            this.name = name;
            let req = new Request(lookup_url(name));
            let resp = await fetch(req);
            bytes = new Uint8Array(await resp.arrayBuffer());
        }

        const font_height = bytes.length / 256;
        if (font_height % 1 !== 0) {
            throw "Error loading font.";
        }
        this.height = font_height;
        this.bitmask = bytes;
        this.width = 8;
        this.length = 256;
        this.use_9px_font = use_9px_font;

        this.canvas = generate_font_canvas(this.bitmask, this.height, this.length);
        if (this.use_9px_font) {
            this.width += 1;
            this.canvas = add_ninth_bit_to_canvas(this.canvas, this.length);
        }

        this.glyphs = this.palette.map((rgb) => coloured_glyphs(this.canvas, rgb));
        this.backgrounds = this.palette.map((rgb) =>
            coloured_background(this.width, this.height, rgb)
        );
        this.cursor = coloured_background(this.width, 2, bright_white);
    }

    /**
     * @param {number} index
     * @param {App.Color} rgb
     * @returns {void}
     */
    replace_cache_at(index, rgb) {
        this.backgrounds[index] = coloured_background(this.width, this.height, rgb);
        this.glyphs[index] = coloured_glyphs(this.canvas, rgb);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {App.Block} block
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    draw(ctx, block, x, y) {
        ctx.drawImage(this.get_background_for(block.bg), x, y, this.width, this.height);
        ctx.drawImage(
            this.get_glyphs_for(block.fg),
            block.code * this.width,
            0,
            this.width,
            this.height,
            x,
            y,
            this.width,
            this.height
        );
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {App.Block} block
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    draw_raw(ctx, block, x, y) {
        const canvas = create_coloured_glyph(
            this.canvas,
            block.code,
            white,
            this.width,
            this.height
        );
        ctx.drawImage(canvas, x, y);
    }

    /**
     * @param {number} i
     * @returns {App.Color}
     */
    get_rgb(i) {
        return this.palette[i];
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} bg
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    draw_bg(ctx, bg, x, y) {
        ctx.drawImage(this.backgrounds[bg], x, y);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    draw_cursor(ctx, x, y) {
        ctx.drawImage(this.cursor, x, y);
    }

    /**
     * @param {number} index
     * @returns {HTMLCanvasElement}
     */
    get_glyphs_for(index) {
        if (!this.glyphs[index]) {
            this.glyphs[index] = coloured_glyphs(this.canvas, this.get_rgb(index));
        }
        return this.glyphs[index];
    }

    /**
     * @param {number} index
     * @returns {HTMLCanvasElement}
     */
    get_background_for(index) {
        if (!this.backgrounds[index]) {
            this.backgrounds[index] = coloured_background(
                this.width,
                this.height,
                this.get_rgb(index)
            );
        }
        return this.backgrounds[index];
    }
}

module.exports = { Font };
