const { Font } = require("./font");
const { create_canvas, join_canvases } = require("./canvas");
const { fromAnsi, encode_as_ansi } = require("./ansi");
const { fromBinaryText, encode_as_bin } = require("./binary_text");
const { fromXBin, encode_as_xbin } = require("./xbin");
const { encode_as_mbd, fromMBD } = require("./moebius_document");
const { palette_4bit } = require("./palette");
const path = require("path");
const { open_box } = require("../senders");
const { TextModeData } = require("./textmode");
const fs = require("fs");
const upng = require("upng-js");
const { getSync } = require("@andreekeberg/imagedata");

/**
 * @param {Buffer} bytes
 * @param {string} file
 * @returns {TextModeData}
 */
function read_bytes(bytes, file) {
    switch (path.extname(file).toLowerCase()) {
        case ".mbd":
            return fromMBD(bytes);
        case ".bin":
            return fromBinaryText(bytes);
        case ".xb":
            return fromXBin(bytes);
        case ".ans":
        default:
            return fromAnsi(bytes);
    }
}

/**
 * @param {string} file
 * @returns {Promise<TextModeData>}
 */
async function read_file(file) {
    return new Promise((resolve) => {
        fs.readFile(file, (err, bytes) => {
            if (err) throw `Error: ${file} not found!`;
            resolve(read_bytes(bytes, file));
        });
    });
}

/**
 * @returns {Promise<number>}
 */
async function next_frame() {
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

/**
 * @param {{file: string, ctx: CanvasRenderingContext2D}} options
 * @returns {Promise<void>}
 */
async function animate({ file, ctx }) {
    const tmdata = await read_file(file);
    const font = new Font(tmdata.palette);
    await font.load({
        name: tmdata.font_name,
        bytes: tmdata.font_bytes,
        use_9px_font: tmdata.use_9px_font,
    });
    for (let y = 0, py = 0, i = 0; y < tmdata.rows; y++, py += font.height) {
        for (let x = 0, px = 0; x < tmdata.columns; x++, px += font.width, i++) {
            const block = tmdata.data[i];
            if (!tmdata.ice_colors && block.bg > 7 && block.bg < 16) {
                font.draw(ctx, { fg: block.fg, bg: block.bg - 8, code: block.code }, px, py);
            } else {
                font.draw(ctx, block, px, py);
            }
            if (i % 30 == 0) await next_frame();
        }
    }
}

/**
 * @param {TextModeData} tmdata
 * @param {Font} font
 * @param {string} file
 * @param {{utf8?: boolean, save_without_sauce?: boolean}} options
 * @returns {void}
 */
function write_file(tmdata, font, file, { utf8 = false, save_without_sauce = false } = {}) {
    let bytes;
    switch (path.extname(file).toLowerCase()) {
        case ".mbd":
            bytes = encode_as_mbd(tmdata);
            break;
        case ".bin":
            bytes = encode_as_bin(tmdata, save_without_sauce);
            break;
        case ".xb":
            bytes = encode_as_xbin(tmdata, font, save_without_sauce);
            break;
        case ".ans":
        default:
            bytes = encode_as_ansi(tmdata, save_without_sauce, { utf8 });
    }
    fs.writeFileSync(file, bytes, "binary");
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} maximum_height
 * @returns {{canvases: HTMLCanvasElement[], ctxs: CanvasRenderingContext2D[]}}
 */
function create_canvases(width, height, maximum_height) {
    const number_of_canvases = Math.floor(height / maximum_height);
    const canvases = [];
    const ctxs = [];
    for (let i = 0; i < number_of_canvases; i++) {
        const { canvas, ctx } = create_canvas(width, maximum_height);
        canvases.push(canvas);
        ctxs.push(ctx);
    }
    const remainder_height = height % maximum_height;
    if (remainder_height) {
        const { canvas, ctx } = create_canvas(width, remainder_height);
        canvases.push(canvas);
        ctxs.push(ctx);
    }
    return { canvases, ctxs };
}

/**
 * @param {App.Blocks} blocks
 * @param {Font} font
 * @param {boolean} transparent
 * @returns {HTMLCanvasElement}
 */
function render_blocks(blocks, font, transparent) {
    const { canvas, ctx } = create_canvas(blocks.columns * font.width, blocks.rows * font.height);
    for (let y = 0, py = 0, i = 0; y < blocks.rows; y++, py += font.height) {
        for (let x = 0, px = 0; x < blocks.columns; x++, px += font.width, i++) {
            const block = blocks.data[i];
            if (!transparent || block.code != 32 || block.bg != 0) font.draw(ctx, block, px, py);
        }
    }
    return canvas;
}

/**
 * @param {App.Blocks} under_blocks
 * @param {App.Blocks} over_blocks
 * @returns {App.Blocks}
 */
function merge_blocks(under_blocks, over_blocks) {
    const merged_blocks = {
        columns: Math.max(under_blocks.columns, over_blocks.columns),
        rows: Math.max(under_blocks.rows, over_blocks.rows),
        data: new Array(
            Math.max(under_blocks.rows, over_blocks.rows) *
                Math.max(under_blocks.columns, over_blocks.columns)
        ),
    };
    for (let y = 0, i = 0; y < merged_blocks.rows; y++) {
        for (let x = 0; x < merged_blocks.columns; x++, i++) {
            const under_block =
                y < under_blocks.rows && x < under_blocks.columns
                    ? under_blocks.data[y * under_blocks.columns + x]
                    : undefined;
            const over_block =
                y < over_blocks.rows && x < over_blocks.columns
                    ? over_blocks.data[y * over_blocks.columns + x]
                    : undefined;
            if (over_block == undefined || (over_block.code == 32 && over_block.bg == 0)) {
                merged_blocks.data[i] = Object.assign(under_block);
            } else {
                merged_blocks.data[i] = Object.assign(over_block);
            }
        }
    }
    return merged_blocks;
}

/**
 * @param {HTMLCanvasElement[]} sources
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}[]}
 */
function copy_canvases(sources) {
    return sources.map((source) => {
        const { canvas, ctx } = create_canvas(source.width, source.height);
        ctx.drawImage(source, 0, 0);
        return { canvas, ctx };
    });
}

/**
 * @param {TextModeData} tmdata
 * @param {number} maximum_rows
 * @returns {Promise<App.Render>}
 */
async function render_split(tmdata, maximum_rows = 100) {
    const font = new Font(tmdata.palette);
    await font.load({
        name: tmdata.font_name,
        bytes: tmdata.font_bytes,
        use_9px_font: tmdata.use_9px_font,
    });
    const { canvases, ctxs } = create_canvases(
        font.width * tmdata.columns,
        font.height * tmdata.rows,
        font.height * maximum_rows
    );
    for (let y = 0, py = 0, i = 0, canvas_i = 0; y < tmdata.rows; y++, py += font.height) {
        if (py == 100 * font.height) {
            py = 0;
            canvas_i += 1;
        }
        for (let x = 0, px = 0; x < tmdata.columns; x++, px += font.width, i++) {
            font.draw(ctxs[canvas_i], tmdata.data[i], px, py);
        }
    }
    const blink_on_collection = copy_canvases(canvases);
    const blink_off_collection = copy_canvases(canvases);
    for (let y = 0, py = 0, i = 0, canvas_i = 0; y < tmdata.rows; y++, py += font.height) {
        if (py == 100 * font.height) {
            py = 0;
            canvas_i += 1;
        }
        for (let x = 0, px = 0; x < tmdata.columns; x++, px += font.width, i++) {
            const block = tmdata.data[i];
            if (block.bg > 7 && block.bg < 16) {
                font.draw_bg(blink_on_collection[canvas_i].ctx, block.bg - 8, px, py);
                font.draw(
                    blink_off_collection[canvas_i].ctx,
                    { fg: block.fg, bg: block.bg - 8, code: block.code },
                    px,
                    py
                );
            }
        }
    }
    return {
        columns: tmdata.columns,
        rows: tmdata.rows,
        width: tmdata.columns * font.width,
        height: tmdata.rows * font.height,
        ice_color_collection: canvases,
        blink_on_collection: blink_on_collection.map((blink_on) => blink_on.canvas),
        blink_off_collection: blink_off_collection.map((blink_off) => blink_off.canvas),
        preview_collection: copy_canvases(canvases).map((collection) => collection.canvas),
        maximum_rows,
        font: font,
    };
}

/**
 * @param {App.Render} render
 * @param {number} x
 * @param {number} y
 * @param {App.Block} block
 * @returns {void}
 */
function render_at(render, x, y, block) {
    const i = Math.floor(y / render.maximum_rows);
    const px = x * render.font.width;
    const py = (y % render.maximum_rows) * render.font.height;
    render.font.draw(render.ice_color_collection[i].getContext("2d"), block, px, py);
    render.font.draw(render.preview_collection[i].getContext("2d"), block, px, py);
    if (block.bg > 7 && block.bg < 16) {
        render.font.draw_bg(render.blink_on_collection[i].getContext("2d"), block.bg - 8, px, py);
        render.font.draw(
            render.blink_off_collection[i].getContext("2d"),
            { code: block.code, fg: block.fg, bg: block.bg - 8 },
            px,
            py
        );
    } else {
        render.font.draw(render.blink_on_collection[i].getContext("2d"), block, px, py);
        render.font.draw(render.blink_off_collection[i].getContext("2d"), block, px, py);
    }
}

/**
 * @param {TextModeData} tmdata
 * @param {number} x
 * @param {App.Render} render
 * @returns {void}
 */
function render_insert_column(tmdata, x, render) {
    const sx = x * render.font.width;
    const width = render.width - x * render.font.width - render.font.width;
    const dx = sx + render.font.width;
    for (let i = 0; i < render.ice_color_collection.length; i++) {
        render.ice_color_collection[i]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[i],
                sx,
                0,
                width,
                render.ice_color_collection[i].height,
                dx,
                0,
                width,
                render.ice_color_collection[i].height
            );
        render.preview_collection[i]
            .getContext("2d")
            .drawImage(
                render.preview_collection[i],
                sx,
                0,
                width,
                render.preview_collection[i].height,
                dx,
                0,
                width,
                render.preview_collection[i].height
            );
        render.blink_on_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[i],
                sx,
                0,
                width,
                render.blink_on_collection[i].height,
                dx,
                0,
                width,
                render.blink_on_collection[i].height
            );
        render.blink_off_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[i],
                sx,
                0,
                width,
                render.blink_off_collection[i].height,
                dx,
                0,
                width,
                render.blink_off_collection[i].height
            );
    }
    for (let y = 0; y < tmdata.rows; y++)
        render_at(render, x, y, tmdata.data[y * tmdata.columns + x]);
}

/**
 * @param {TextModeData} tmdata
 * @param {number} x
 * @param {App.Render} render
 * @returns {void}
 */
function render_delete_column(tmdata, x, render) {
    const sx = x * render.font.width + render.font.width;
    const width = render.width - x * render.font.width - render.font.width;
    const dx = sx - render.font.width;
    for (let i = 0; i < render.ice_color_collection.length; i++) {
        render.ice_color_collection[i]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[i],
                sx,
                0,
                width,
                render.ice_color_collection[i].height,
                dx,
                0,
                width,
                render.ice_color_collection[i].height
            );
        render.preview_collection[i]
            .getContext("2d")
            .drawImage(
                render.preview_collection[i],
                sx,
                0,
                width,
                render.preview_collection[i].height,
                dx,
                0,
                width,
                render.preview_collection[i].height
            );
        render.blink_on_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[i],
                sx,
                0,
                width,
                render.blink_on_collection[i].height,
                dx,
                0,
                width,
                render.blink_on_collection[i].height
            );
        render.blink_off_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[i],
                sx,
                0,
                width,
                render.blink_off_collection[i].height,
                dx,
                0,
                width,
                render.blink_off_collection[i].height
            );
    }
    for (let y = 0; y < tmdata.rows; y++)
        render_at(
            render,
            tmdata.columns - 1,
            y,
            tmdata.data[y * tmdata.columns + tmdata.columns - 1]
        );
}

/**
 * @param {TextModeData} tmdata
 * @param {number} y
 * @param {App.Render} render
 * @returns {void}
 */
function render_insert_row(tmdata, y, render) {
    const canvas_row = Math.floor(y / render.maximum_rows);
    for (let i = render.ice_color_collection.length - 1; i > canvas_row; i--) {
        const ice_color_ctx = render.ice_color_collection[i].getContext("2d");
        const preview_collection_ctx = render.preview_collection[i].getContext("2d");
        const blink_on_ctx = render.blink_on_collection[i].getContext("2d");
        const blink_off_ctx = render.blink_off_collection[i].getContext("2d");
        ice_color_ctx.drawImage(
            render.ice_color_collection[i],
            0,
            0,
            render.ice_color_collection[i].width,
            render.ice_color_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.ice_color_collection[i].width,
            render.ice_color_collection[i].height - render.font.height
        );
        ice_color_ctx.drawImage(
            render.ice_color_collection[i - 1],
            0,
            render.ice_color_collection[i - 1].height - render.font.height,
            render.ice_color_collection[i - 1].width,
            render.font.height,
            0,
            0,
            render.ice_color_collection[i].width,
            render.font.height
        );
        preview_collection_ctx.drawImage(
            render.preview_collection[i],
            0,
            0,
            render.preview_collection[i].width,
            render.preview_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.preview_collection[i].width,
            render.preview_collection[i].height - render.font.height
        );
        preview_collection_ctx.drawImage(
            render.preview_collection[i - 1],
            0,
            render.preview_collection[i - 1].height - render.font.height,
            render.preview_collection[i - 1].width,
            render.font.height,
            0,
            0,
            render.preview_collection[i].width,
            render.font.height
        );
        blink_on_ctx.drawImage(
            render.blink_on_collection[i],
            0,
            0,
            render.blink_on_collection[i].width,
            render.blink_on_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.blink_on_collection[i].width,
            render.blink_on_collection[i].height - render.font.height
        );
        blink_on_ctx.drawImage(
            render.blink_on_collection[i - 1],
            0,
            render.blink_on_collection[i - 1].height - render.font.height,
            render.blink_on_collection[i - 1].width,
            render.font.height,
            0,
            0,
            render.blink_on_collection[i].width,
            render.font.height
        );
        blink_off_ctx.drawImage(
            render.blink_off_collection[i],
            0,
            0,
            render.blink_off_collection[i].width,
            render.blink_off_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.blink_off_collection[i].width,
            render.blink_off_collection[i].height - render.font.height
        );
        blink_off_ctx.drawImage(
            render.blink_off_collection[i - 1],
            0,
            render.blink_off_collection[i - 1].height - render.font.height,
            render.blink_off_collection[i - 1].width,
            render.font.height,
            0,
            0,
            render.blink_off_collection[i].width,
            render.font.height
        );
    }
    const sy = (y % render.maximum_rows) * render.font.height;
    const height = render.ice_color_collection[canvas_row].height - sy - render.font.height;
    render.ice_color_collection[canvas_row]
        .getContext("2d")
        .drawImage(
            render.ice_color_collection[canvas_row],
            0,
            sy,
            render.ice_color_collection[canvas_row].width,
            height,
            0,
            sy + render.font.height,
            render.ice_color_collection[canvas_row].width,
            height
        );
    render.preview_collection[canvas_row]
        .getContext("2d")
        .drawImage(
            render.preview_collection[canvas_row],
            0,
            sy,
            render.preview_collection[canvas_row].width,
            height,
            0,
            sy + render.font.height,
            render.preview_collection[canvas_row].width,
            height
        );
    render.blink_on_collection[canvas_row]
        .getContext("2d")
        .drawImage(
            render.blink_on_collection[canvas_row],
            0,
            sy,
            render.blink_on_collection[canvas_row].width,
            height,
            0,
            sy + render.font.height,
            render.blink_on_collection[canvas_row].width,
            height
        );
    render.blink_off_collection[canvas_row]
        .getContext("2d")
        .drawImage(
            render.blink_off_collection[canvas_row],
            0,
            sy,
            render.blink_off_collection[canvas_row].width,
            height,
            0,
            sy + render.font.height,
            render.blink_off_collection[canvas_row].width,
            height
        );
    for (let x = 0; x < tmdata.columns; x++)
        render_at(render, x, y, tmdata.data[y * tmdata.columns + x]);
}

/**
 * @param {TextModeData} tmdata
 * @param {number} y
 * @param {App.Render} render
 * @returns {void}
 */
function render_delete_row(tmdata, y, render) {
    const canvas_row = Math.floor(y / render.maximum_rows);
    if ((y % render.maximum_rows) + 1 < render.maximum_rows) {
        const sy = (y % render.maximum_rows) * render.font.height + render.font.height;
        const height = render.ice_color_collection[canvas_row].height - sy;
        render.ice_color_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[canvas_row],
                0,
                sy,
                render.ice_color_collection[canvas_row].width,
                height,
                0,
                sy - render.font.height,
                render.ice_color_collection[canvas_row].width,
                height
            );
        render.preview_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.preview_collection[canvas_row],
                0,
                sy,
                render.preview_collection[canvas_row].width,
                height,
                0,
                sy - render.font.height,
                render.preview_collection[canvas_row].width,
                height
            );
        render.blink_on_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[canvas_row],
                0,
                sy,
                render.blink_on_collection[canvas_row].width,
                height,
                0,
                sy - render.font.height,
                render.blink_on_collection[canvas_row].width,
                height
            );
        render.blink_off_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[canvas_row],
                0,
                sy,
                render.blink_off_collection[canvas_row].width,
                height,
                0,
                sy - render.font.height,
                render.blink_off_collection[canvas_row].width,
                height
            );
    }
    if (canvas_row < render.ice_color_collection.length - 1) {
        render.ice_color_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[canvas_row + 1],
                0,
                0,
                render.ice_color_collection[canvas_row + 1].width,
                render.font.height,
                0,
                render.ice_color_collection[canvas_row].height - render.font.height,
                render.ice_color_collection[canvas_row].width,
                render.font.height
            );
        render.preview_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.preview_collection[canvas_row + 1],
                0,
                0,
                render.preview_collection[canvas_row + 1].width,
                render.font.height,
                0,
                render.preview_collection[canvas_row].height - render.font.height,
                render.preview_collection[canvas_row].width,
                render.font.height
            );
        render.blink_on_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[canvas_row + 1],
                0,
                0,
                render.blink_on_collection[canvas_row + 1].width,
                render.font.height,
                0,
                render.blink_on_collection[canvas_row].height - render.font.height,
                render.blink_on_collection[canvas_row].width,
                render.font.height
            );
        render.blink_off_collection[canvas_row]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[canvas_row + 1],
                0,
                0,
                render.blink_off_collection[canvas_row + 1].width,
                render.font.height,
                0,
                render.blink_off_collection[canvas_row].height - render.font.height,
                render.blink_off_collection[canvas_row].width,
                render.font.height
            );
    }
    for (let i = canvas_row + 1; i < render.ice_color_collection.length; i++) {
        render.ice_color_collection[i]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[i],
                0,
                render.font.height,
                render.ice_color_collection[i].width,
                render.ice_color_collection[i].height - render.font.height,
                0,
                0,
                render.ice_color_collection[i].width,
                render.ice_color_collection[i].height - render.font.height
            );
        render.preview_collection[i]
            .getContext("2d")
            .drawImage(
                render.preview_collection[i],
                0,
                render.font.height,
                render.preview_collection[i].width,
                render.preview_collection[i].height - render.font.height,
                0,
                0,
                render.preview_collection[i].width,
                render.preview_collection[i].height - render.font.height
            );
        render.blink_on_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[i],
                0,
                render.font.height,
                render.blink_on_collection[i].width,
                render.blink_on_collection[i].height - render.font.height,
                0,
                0,
                render.blink_on_collection[i].width,
                render.blink_on_collection[i].height - render.font.height
            );
        render.blink_off_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[i],
                0,
                render.font.height,
                render.blink_off_collection[i].width,
                render.blink_off_collection[i].height - render.font.height,
                0,
                0,
                render.blink_off_collection[i].width,
                render.blink_off_collection[i].height - render.font.height
            );
        if (i < render.ice_color_collection.length - 1) {
            render.ice_color_collection[i]
                .getContext("2d")
                .drawImage(
                    render.ice_color_collection[i + 1],
                    0,
                    0,
                    render.ice_color_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.ice_color_collection[i].height - render.font.height,
                    render.ice_color_collection[i].width,
                    render.font.height
                );
            render.preview_collection[i]
                .getContext("2d")
                .drawImage(
                    render.preview_collection[i + 1],
                    0,
                    0,
                    render.preview_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.preview_collection[i].height - render.font.height,
                    render.preview_collection[i].width,
                    render.font.height
                );
            render.blink_on_collection[i]
                .getContext("2d")
                .drawImage(
                    render.blink_on_collection[i + 1],
                    0,
                    0,
                    render.blink_on_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.blink_on_collection[i].height - render.font.height,
                    render.blink_on_collection[i].width,
                    render.font.height
                );
            render.blink_off_collection[i]
                .getContext("2d")
                .drawImage(
                    render.blink_off_collection[i + 1],
                    0,
                    0,
                    render.blink_off_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.blink_off_collection[i].height - render.font.height,
                    render.blink_off_collection[i].width,
                    render.font.height
                );
        }
    }
    for (let x = 0; x < tmdata.columns; x++)
        render_at(render, x, tmdata.rows - 1, tmdata.data[(tmdata.rows - 1) * tmdata.columns + x]);
}

/**
 * @param {number} code
 * @returns {number}
 */
function flip_code_x(code) {
    switch (code) {
        case 40:
            return 41;
        case 41:
            return 40;
        case 47:
            return 92;
        case 60:
            return 62;
        case 62:
            return 60;
        case 91:
            return 93;
        case 92:
            return 47;
        case 93:
            return 91;
        case 123:
            return 125;
        case 125:
            return 123;
        case 169:
            return 170;
        case 170:
            return 169;
        case 174:
            return 175;
        case 175:
            return 174;
        case 180:
            return 195;
        case 181:
            return 198;
        case 182:
            return 199;
        case 183:
            return 214;
        case 184:
            return 213;
        case 185:
            return 204;
        case 187:
            return 201;
        case 188:
            return 200;
        case 189:
            return 211;
        case 195:
            return 180;
        case 198:
            return 181;
        case 190:
            return 212;
        case 191:
            return 218;
        case 192:
            return 217;
        case 199:
            return 182;
        case 200:
            return 188;
        case 201:
            return 187;
        case 204:
            return 185;
        case 211:
            return 189;
        case 212:
            return 190;
        case 213:
            return 184;
        case 214:
            return 183;
        case 217:
            return 192;
        case 218:
            return 191;
        case 221:
            return 222;
        case 222:
            return 221;
        case 242:
            return 243;
        case 243:
            return 242;
        default:
            return code;
    }
}

/**
 * @param {App.Blocks} blocks
 * @returns {App.Blocks}
 */
function flip_x(blocks) {
    const new_data = Array(blocks.data.length);
    for (let y = 0, i = 0; y < blocks.rows; y++) {
        for (let x = 0; x < blocks.columns; x++, i++) {
            new_data[blocks.columns * y + blocks.columns - 1 - x] = Object.assign({
                ...blocks.data[i],
                code: flip_code_x(blocks.data[i].code),
            });
        }
    }
    blocks.data = new_data;
    return blocks;
}

/**
 * @param {number} code
 * @returns {number}
 */
function flip_code_y(code) {
    switch (code) {
        case 183:
            return 189;
        case 184:
            return 190;
        case 187:
            return 188;
        case 188:
            return 187;
        case 189:
            return 183;
        case 190:
            return 184;
        case 191:
            return 217;
        case 192:
            return 218;
        case 193:
            return 194;
        case 194:
            return 193;
        case 200:
            return 201;
        case 201:
            return 200;
        case 202:
            return 203;
        case 203:
            return 202;
        case 207:
            return 209;
        case 208:
            return 210;
        case 209:
            return 207;
        case 210:
            return 208;
        case 211:
            return 214;
        case 212:
            return 213;
        case 213:
            return 212;
        case 214:
            return 211;
        case 217:
            return 191;
        case 218:
            return 192;
        case 220:
            return 223;
        case 223:
            return 220;
        default:
            return code;
    }
}

/**
 * @param {App.Blocks} blocks
 * @returns {App.Blocks}
 */
function flip_y(blocks) {
    const new_data = Array(blocks.data.length);
    for (let y = 0, i = 0; y < blocks.rows; y++) {
        for (let x = 0; x < blocks.columns; x++, i++) {
            new_data[blocks.columns * (blocks.rows - 1 - y) + x] = Object.assign({
                ...blocks.data[i],
                code: flip_code_y(blocks.data[i].code),
            });
        }
    }
    blocks.data = new_data;
    return blocks;
}

/**
 * @param {number} code
 * @returns {number}
 */
function rotate_code(code) {
    // TODO: more cases; http://www.asciitable.com
    switch (code) {
        case 220:
            return 221;
        case 221:
            return 223;
        case 222:
            return 220;
        case 187:
            return 188;
        case 223:
            return 222;
        default:
            return code;
    }
}

/**
 * @param {App.Blocks} blocks
 * @returns {App.Blocks}
 */
function rotate(blocks) {
    const new_data = Array(blocks.data.length);
    const new_columns = blocks.rows,
        new_rows = blocks.columns;
    for (let y = 0, i = 0; y < new_rows; y++) {
        for (let x = 0; x < new_columns; x++, i++) {
            const j = (new_columns - 1 - x) * blocks.columns + y;
            new_data[i] = Object.assign({
                ...blocks.data[j],
                code: rotate_code(blocks.data[j].code),
            });
        }
    }
    blocks.data = new_data;
    blocks.columns = new_columns;
    blocks.rows = new_rows;
    return blocks;
}

/**
 * @param {TextModeData} tmdata
 * @param {number} insert_y
 * @param {App.Block[]} [blocks]
 * @returns {App.Block[]}
 */
function insert_row(tmdata, insert_y, blocks) {
    const removed_blocks = new Array(tmdata.columns);
    for (let x = 0; x < tmdata.columns; x++)
        removed_blocks[x] = Object.assign(tmdata.data[(tmdata.rows - 1) * tmdata.columns + x]);
    for (let y = tmdata.rows - 1; y > insert_y; y--) {
        for (let x = 0; x < tmdata.columns; x++) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i - tmdata.columns]);
        }
    }
    for (let x = 0; x < tmdata.columns; x++)
        tmdata.data[insert_y * tmdata.columns + x] = blocks
            ? Object.assign(blocks[x])
            : { fg: 7, bg: 0, code: 32 };
    return removed_blocks;
}

/**
 * @param {TextModeData} tmdata
 * @param {number} delete_y
 * @param {App.Block[]} [blocks]
 * @returns {App.Block[]}
 */
function delete_row(tmdata, delete_y, blocks) {
    const removed_blocks = new Array(tmdata.columns);
    for (let x = 0; x < tmdata.columns; x++)
        removed_blocks[x] = Object.assign(tmdata.data[delete_y * tmdata.columns + x]);
    for (let y = delete_y; y < tmdata.rows - 1; y++) {
        for (let x = 0; x < tmdata.columns; x++) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i + tmdata.columns]);
        }
    }
    for (let x = 0; x < tmdata.columns; x++)
        tmdata.data[(tmdata.rows - 1) * tmdata.columns + x] = blocks
            ? Object.assign(blocks[x])
            : { fg: 7, bg: 0, code: 32 };
    return removed_blocks;
}

/**
 * @param {TextModeData} tmdata
 * @param {number} insert_x
 * @param {App.Block[]} [blocks]
 * @returns {App.Block[]}
 */
function insert_column(tmdata, insert_x, blocks) {
    const removed_blocks = new Array(tmdata.rows);
    for (let y = 0; y < tmdata.rows; y++)
        removed_blocks[y] = Object.assign(tmdata.data[y * tmdata.columns + tmdata.columns - 1]);
    for (let x = tmdata.columns - 1; x > insert_x; x--) {
        for (let y = 0; y < tmdata.rows; y++) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i - 1]);
        }
    }
    for (let y = 0; y < tmdata.rows; y++)
        tmdata.data[y * tmdata.columns + insert_x] = blocks
            ? Object.assign(blocks[y])
            : { fg: 7, bg: 0, code: 32 };
    return removed_blocks;
}

/**
 * @param {TextModeData} tmdata
 * @param {number} delete_x
 * @param {App.Block[]} [blocks]
 * @returns {App.Block[]}
 */
function delete_column(tmdata, delete_x, blocks) {
    const removed_blocks = new Array(tmdata.rows);
    for (let y = 0; y < tmdata.rows; y++)
        removed_blocks[y] = Object.assign(tmdata.data[y * tmdata.columns + delete_x]);
    for (let x = delete_x; x < tmdata.columns - 1; x++) {
        for (let y = 0; y < tmdata.rows; y++) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i + 1]);
        }
    }
    for (let y = 0; y < tmdata.rows; y++)
        tmdata.data[y * tmdata.columns + tmdata.columns - 1] = blocks
            ? Object.assign(blocks[y])
            : { fg: 7, bg: 0, code: 32 };
    return removed_blocks;
}

/**
 * @param {TextModeData} tmdata
 * @returns {void}
 */
function scroll_canvas_up(tmdata) {
    for (let x = 0; x < tmdata.columns; x++) {
        const overwritten_block = Object.assign(tmdata.data[x]);
        for (let y = 0; y < tmdata.rows - 1; y++) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i + tmdata.columns]);
        }
        tmdata.data[(tmdata.rows - 1) * tmdata.columns + x] = Object.assign(overwritten_block);
    }
}

/**
 * @param {TextModeData} tmdata
 * @returns {void}
 */
function scroll_canvas_down(tmdata) {
    for (let x = 0; x < tmdata.columns; x++) {
        const overwritten_block = Object.assign(
            tmdata.data[(tmdata.rows - 1) * tmdata.columns + x]
        );
        for (let y = tmdata.rows; y > 0; y--) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i - tmdata.columns]);
        }
        tmdata.data[x] = Object.assign(overwritten_block);
    }
}

/**
 * @param {TextModeData} tmdata
 * @returns {void}
 */
function scroll_canvas_left(tmdata) {
    for (let y = 0; y < tmdata.rows; y++) {
        const overwritten_block = Object.assign(tmdata.data[y * tmdata.columns]);
        for (let x = 0; x < tmdata.columns - 1; x++) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i + 1]);
        }
        tmdata.data[y * tmdata.columns + tmdata.columns - 1] = Object.assign(overwritten_block);
    }
}

/**
 * @param {TextModeData} tmdata
 * @returns {void}
 */
function scroll_canvas_right(tmdata) {
    for (let y = 0; y < tmdata.rows; y++) {
        const overwritten_block = Object.assign(
            tmdata.data[y * tmdata.columns + tmdata.columns - 1]
        );
        for (let x = tmdata.columns - 1; x > 0; x--) {
            const i = y * tmdata.columns + x;
            tmdata.data[i] = Object.assign(tmdata.data[i - 1]);
        }
        tmdata.data[y * tmdata.columns] = Object.assign(overwritten_block);
    }
}

/**
 * @param {TextModeData} tmdata
 * @param {App.Render} render
 * @returns {void}
 */
function render_scroll_canvas_up(tmdata, render) {
    for (let i = 0; i < render.ice_color_collection.length; i++) {
        render.ice_color_collection[i]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[i],
                0,
                render.font.height,
                render.ice_color_collection[i].width,
                render.ice_color_collection[i].height - render.font.height,
                0,
                0,
                render.ice_color_collection[i].width,
                render.ice_color_collection[i].height - render.font.height
            );
        render.preview_collection[i]
            .getContext("2d")
            .drawImage(
                render.preview_collection[i],
                0,
                render.font.height,
                render.preview_collection[i].width,
                render.preview_collection[i].height - render.font.height,
                0,
                0,
                render.preview_collection[i].width,
                render.preview_collection[i].height - render.font.height
            );
        render.blink_on_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[i],
                0,
                render.font.height,
                render.blink_on_collection[i].width,
                render.blink_on_collection[i].height - render.font.height,
                0,
                0,
                render.blink_on_collection[i].width,
                render.blink_on_collection[i].height - render.font.height
            );
        render.blink_off_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[i],
                0,
                render.font.height,
                render.blink_off_collection[i].width,
                render.blink_off_collection[i].height - render.font.height,
                0,
                0,
                render.blink_off_collection[i].width,
                render.blink_off_collection[i].height - render.font.height
            );
        if (i < render.ice_color_collection.length - 1) {
            render.ice_color_collection[i]
                .getContext("2d")
                .drawImage(
                    render.ice_color_collection[i + 1],
                    0,
                    0,
                    render.ice_color_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.ice_color_collection[i].height - render.font.height,
                    render.ice_color_collection[i].width,
                    render.font.height
                );
            render.preview_collection[i]
                .getContext("2d")
                .drawImage(
                    render.preview_collection[i + 1],
                    0,
                    0,
                    render.preview_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.preview_collection[i].height - render.font.height,
                    render.preview_collection[i].width,
                    render.font.height
                );
            render.blink_on_collection[i]
                .getContext("2d")
                .drawImage(
                    render.blink_on_collection[i + 1],
                    0,
                    0,
                    render.blink_on_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.blink_on_collection[i].height - render.font.height,
                    render.blink_on_collection[i].width,
                    render.font.height
                );
            render.blink_off_collection[i]
                .getContext("2d")
                .drawImage(
                    render.blink_off_collection[i + 1],
                    0,
                    0,
                    render.blink_off_collection[i + 1].width,
                    render.font.height,
                    0,
                    render.blink_off_collection[i].height - render.font.height,
                    render.blink_off_collection[i].width,
                    render.font.height
                );
        }
    }
    for (let x = 0; x < tmdata.columns; x++)
        render_at(render, x, tmdata.rows - 1, tmdata.data[(tmdata.rows - 1) * tmdata.columns + x]);
}

/**
 * @param {TextModeData} tmdata
 * @param {App.Render} render
 * @returns {void}
 */
function render_scroll_canvas_down(tmdata, render) {
    for (let i = render.ice_color_collection.length - 1; i >= 0; i--) {
        const ice_color_ctx = render.ice_color_collection[i].getContext("2d");
        const preview_collection_ctx = render.preview_collection[i].getContext("2d");
        const blink_on_ctx = render.blink_on_collection[i].getContext("2d");
        const blink_off_ctx = render.blink_off_collection[i].getContext("2d");
        ice_color_ctx.drawImage(
            render.ice_color_collection[i],
            0,
            0,
            render.ice_color_collection[i].width,
            render.ice_color_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.ice_color_collection[i].width,
            render.ice_color_collection[i].height - render.font.height
        );
        preview_collection_ctx.drawImage(
            render.preview_collection[i],
            0,
            0,
            render.preview_collection[i].width,
            render.preview_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.preview_collection[i].width,
            render.preview_collection[i].height - render.font.height
        );
        blink_on_ctx.drawImage(
            render.blink_on_collection[i],
            0,
            0,
            render.blink_on_collection[i].width,
            render.blink_on_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.blink_on_collection[i].width,
            render.blink_on_collection[i].height - render.font.height
        );
        blink_off_ctx.drawImage(
            render.blink_off_collection[i],
            0,
            0,
            render.blink_off_collection[i].width,
            render.blink_off_collection[i].height - render.font.height,
            0,
            render.font.height,
            render.blink_off_collection[i].width,
            render.blink_off_collection[i].height - render.font.height
        );
        if (i > 0) {
            ice_color_ctx.drawImage(
                render.ice_color_collection[i - 1],
                0,
                render.ice_color_collection[i - 1].height - render.font.height,
                render.ice_color_collection[i - 1].width,
                render.font.height,
                0,
                0,
                render.ice_color_collection[i].width,
                render.font.height
            );
            preview_collection_ctx.drawImage(
                render.preview_collection[i - 1],
                0,
                render.preview_collection[i - 1].height - render.font.height,
                render.preview_collection[i - 1].width,
                render.font.height,
                0,
                0,
                render.preview_collection[i].width,
                render.font.height
            );
            blink_on_ctx.drawImage(
                render.blink_on_collection[i - 1],
                0,
                render.blink_on_collection[i - 1].height - render.font.height,
                render.blink_on_collection[i - 1].width,
                render.font.height,
                0,
                0,
                render.blink_on_collection[i].width,
                render.font.height
            );
            blink_off_ctx.drawImage(
                render.blink_off_collection[i - 1],
                0,
                render.blink_off_collection[i - 1].height - render.font.height,
                render.blink_off_collection[i - 1].width,
                render.font.height,
                0,
                0,
                render.blink_off_collection[i].width,
                render.font.height
            );
        }
    }
    for (let x = 0; x < tmdata.columns; x++) render_at(render, x, 0, tmdata.data[x]);
}

/**
 * @param {TextModeData} tmdata
 * @param {App.Render} render
 * @returns {void}
 */
function render_scroll_canvas_left(tmdata, render) {
    for (let i = 0; i < render.ice_color_collection.length; i++) {
        render.ice_color_collection[i]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[i],
                render.font.width,
                0,
                render.ice_color_collection[i].width - render.font.width,
                render.ice_color_collection[i].height,
                0,
                0,
                render.ice_color_collection[i].width - render.font.width,
                render.ice_color_collection[i].height
            );
        render.preview_collection[i]
            .getContext("2d")
            .drawImage(
                render.preview_collection[i],
                render.font.width,
                0,
                render.preview_collection[i].width - render.font.width,
                render.preview_collection[i].height,
                0,
                0,
                render.preview_collection[i].width - render.font.width,
                render.preview_collection[i].height
            );
        render.blink_on_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[i],
                render.font.width,
                0,
                render.blink_on_collection[i].width - render.font.width,
                render.blink_on_collection[i].height,
                0,
                0,
                render.blink_on_collection[i].width - render.font.width,
                render.blink_on_collection[i].height
            );
        render.blink_off_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[i],
                render.font.width,
                0,
                render.blink_off_collection[i].width - render.font.width,
                render.blink_off_collection[i].height,
                0,
                0,
                render.blink_off_collection[i].width - render.font.width,
                render.blink_off_collection[i].height
            );
    }
    for (let y = 0; y < tmdata.rows; y++)
        render_at(
            render,
            tmdata.columns - 1,
            y,
            tmdata.data[y * tmdata.columns + tmdata.columns - 1]
        );
}

/**
 * @param {TextModeData} tmdata
 * @param {App.Render} render
 * @returns {void}
 */
function render_scroll_canvas_right(tmdata, render) {
    for (let i = 0; i < render.ice_color_collection.length; i++) {
        render.ice_color_collection[i]
            .getContext("2d")
            .drawImage(
                render.ice_color_collection[i],
                0,
                0,
                render.ice_color_collection[i].width - render.font.width,
                render.ice_color_collection[i].height,
                render.font.width,
                0,
                render.ice_color_collection[i].width - render.font.width,
                render.ice_color_collection[i].height
            );
        render.preview_collection[i]
            .getContext("2d")
            .drawImage(
                render.preview_collection[i],
                0,
                0,
                render.preview_collection[i].width - render.font.width,
                render.preview_collection[i].height,
                render.font.width,
                0,
                render.preview_collection[i].width - render.font.width,
                render.preview_collection[i].height
            );
        render.blink_on_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_on_collection[i],
                0,
                0,
                render.blink_on_collection[i].width - render.font.width,
                render.blink_on_collection[i].height,
                render.font.width,
                0,
                render.blink_on_collection[i].width - render.font.width,
                render.blink_on_collection[i].height
            );
        render.blink_off_collection[i]
            .getContext("2d")
            .drawImage(
                render.blink_off_collection[i],
                0,
                0,
                render.blink_off_collection[i].width - render.font.width,
                render.blink_off_collection[i].height,
                render.font.width,
                0,
                render.blink_off_collection[i].width - render.font.width,
                render.blink_off_collection[i].height
            );
    }
    for (let y = 0; y < tmdata.rows; y++) render_at(render, 0, y, tmdata.data[y * tmdata.columns]);
}

/**
 * @param {App.TextModeDataOptions} [options={}]
 * @returns {TextModeData}
 */
function new_tmdata({
    columns = 80,
    rows = 100,
    title = "",
    author = "",
    group = "",
    date = "",
    palette = [...palette_4bit],
    font_name = "IBM VGA",
    ice_colors = true,
    use_9px_font = false,
    comments = "",
    data = null,
    font_bytes = null,
} = {}) {
    if (!data || data.length != columns * rows) {
        data = new Array(columns * rows);
        for (let i = 0; i < data.length; i++) data[i] = { fg: 7, bg: 0, code: 32 };
    }

    return new TextModeData({
        columns,
        rows,
        data,
        title,
        author,
        group,
        date,
        palette,
        font_name,
        ice_colors,
        use_9px_font,
        comments,
        font_bytes,
    });
}

/**
 * @param {HTMLCanvasElement[]} canvases
 * @returns {string}
 */
function get_data_url(canvases) {
    return join_canvases(canvases).toDataURL("image/png");
}

/**
 * @param {TextModeData} tmdata
 * @param {number} sx
 * @param {number} sy
 * @param {number} dx
 * @param {number} dy
 * @returns {App.Blocks}
 */
function get_blocks(tmdata, sx, sy, dx, dy) {
    dx = Math.min(tmdata.columns - 1, dx);
    dy = Math.min(tmdata.rows - 1, dy);
    const columns = dx - sx + 1;
    const rows = dy - sy + 1;
    const blocks = { columns, rows, data: new Array(columns * rows) };
    for (let y = sy, i = 0; y <= dy; y++) {
        for (let x = sx; x <= dx; x++, i++) {
            blocks.data[i] = Object.assign(tmdata.data[y * tmdata.columns + x]);
        }
    }
    return blocks;
}

/**
 * @param {TextModeData} tmdata
 * @returns {App.Blocks}
 */
function get_all_blocks(tmdata) {
    return get_blocks(tmdata, 0, 0, tmdata.columns - 1, tmdata.rows - 1);
}

/**
 * @param {TextModeData} tmdata
 * @param {App.Font} font
 * @param {string} file
 * @returns {void}
 */
function export_font(tmdata, font, file) {
    const bytes = font.bitmask;
    fs.writeFileSync(file, Buffer.from(bytes));
}

/**
 * @param {TextModeData} tmdata
 * @param {App.Render} render
 * @param {string} file
 * @returns {void}
 */
function export_as_png(tmdata, render, file) {
    const base64_string = get_data_url(
        tmdata.ice_colors ? render.ice_color_collection : render.blink_off_collection
    )
        .split(";base64,")
        .pop();
    fs.writeFileSync(file, base64_string, "base64");
}

/**
 * @param {App.Render} render
 * @param {string} file
 * @returns {void}
 */
function export_as_apng(render, file) {
    const blink_off = join_canvases(render.blink_off_collection)
        .getContext("2d")
        .getImageData(0, 0, render.width, render.height).data;
    const blink_on = join_canvases(render.blink_on_collection)
        .getContext("2d")
        .getImageData(0, 0, render.width, render.height).data;
    const bytes = upng.encode(
        [blink_off.buffer, blink_on.buffer],
        render.width,
        render.height,
        16,
        [300, 300]
    );
    fs.writeFileSync(file, Buffer.from(bytes));
}

/**
 * @param {App.Block} block
 * @returns {App.Block}
 */
function remove_ice_color_for_block(block) {
    if (block.fg == block.bg) {
        return { fg: block.bg, bg: 0, code: 219 };
    }
    switch (block.code) {
        case 0:
        case 32:
        case 255:
            return { fg: block.bg, bg: 0, code: 219 };
        case 219:
            return { fg: block.fg, bg: 0, code: 219 };
    }
    if (block.fg < 8) {
        switch (block.code) {
            case 176:
                return { fg: block.bg, bg: block.fg, code: 178 };
            case 177:
                return { fg: block.bg, bg: block.fg, code: 177 };
            case 178:
                return { fg: block.bg, bg: block.fg, code: 176 };
            case 220:
                return { fg: block.bg, bg: block.fg, code: 223 };
            case 221:
                return { fg: block.bg, bg: block.fg, code: 222 };
            case 222:
                return { fg: block.bg, bg: block.fg, code: 221 };
            case 223:
                return { fg: block.bg, bg: block.fg, code: 220 };
        }
    }
    return { fg: block.fg, bg: block.bg - 8, code: block.code };
}

/**
 * @returns {Promise<{bytes: Buffer, filename: string} | undefined>}
 */
async function importFontFromImage() {
    const file = open_box({
        filters: [
            { name: "Image", extensions: ["png", "gif"] },
            { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
    });
    if (file) {
        return new Promise((resolve) => {
            fs.readFile(file[0], (err, bytes) => {
                if (err) throw `Error: ${file} not found!`;
                resolve({ bytes: bytes, filename: file[0] });
            });
        });
    }
}

/**
 * @param {string} file
 * @returns {Promise<{bytes: Buffer, filename: string}>}
 */
async function load_custom_font(file) {
    return new Promise((resolve) => {
        fs.readFile(file, (err, bytes) => {
            if (err) throw `Error: ${file} not found!`;
            resolve({ bytes: bytes, filename: file });
        });
    });
}

/**
 * @param {Buffer} content
 * @returns {Promise<ImageData>}
 */
async function getImageData(content) {
    return getSync(content);
}

/**
 * @param {Uint8ClampedArray} data
 * @returns {Promise<number[]>}
 */
async function processImageDataTo1bit(data) {
    let bit_array = [];
    for (var i = 0, n = 0; (n = data.length), i < n; i += 4) {
        var bit = data[i];
        if (bit == 0) {
            bit_array.push(0);
        } else {
            bit_array.push(1);
        }
    }
    return bit_array;
}

/**
 * @param {number[]} bit_array
 * @param {number} height
 * @returns {Promise<string>}
 */
async function rearrangeBitArray(bit_array, height) {
    const cellHeight = height / 16;
    let rearrangedBitArray = [];

    for (var image_y = 0; image_y < 16; image_y++) {
        for (var image_x = 0; image_x < 16; image_x++) {
            for (var cell_y = 0; cell_y < cellHeight; cell_y++) {
                for (var cell_x = 0; cell_x < 8; cell_x++) {
                    rearrangedBitArray.push(
                        bit_array[
                            cell_x + cell_y * 16 * 8 + image_x * 8 + image_y * cellHeight * 16 * 8
                        ]
                    );
                }
            }
        }
    }
    return splitToBulks(splitToHexBulks(rearrangedBitArray, 16), 8);
}

/**
 * @param {string} num
 * @param {number} size
 * @returns {string}
 */
function pad(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length - size);
}

/**
 * @param {number[]} arr
 * @param {number} bulkSize
 * @returns {string[]}
 */
function splitToHexBulks(arr, bulkSize) {
    const bulks = [];
    for (let i = 0; i < Math.ceil(arr.length / bulkSize); i++) {
        bulks.push(
            pad(parseInt(arr.slice(i * bulkSize, (i + 1) * bulkSize).join(""), 2).toString(16), 4)
        );
    }
    return bulks;
}

/**
 * @param {string[]} arr
 * @param {number} bulkSize
 * @returns {string}
 */
function splitToBulks(arr, bulkSize) {
    let bulks = "";
    for (let i = 0; i < Math.ceil(arr.length / bulkSize); i++) {
        bulks += arr.slice(i * bulkSize, (i + 1) * bulkSize).join("");
    }
    return bulks;
}

module.exports = {
    Font,
    read_file,
    export_font,
    load_custom_font,
    importFontFromImage,
    getImageData,
    rearrangeBitArray,
    processImageDataTo1bit,
    write_file,
    animate,
    render_split,
    render_at,
    render_insert_column,
    render_delete_column,
    render_insert_row,
    render_delete_row,
    new_tmdata,
    render_blocks,
    merge_blocks,
    flip_code_x,
    flip_x,
    flip_y,
    rotate,
    insert_column,
    insert_row,
    delete_column,
    delete_row,
    scroll_canvas_up,
    scroll_canvas_down,
    scroll_canvas_left,
    scroll_canvas_right,
    render_scroll_canvas_up,
    render_scroll_canvas_down,
    render_scroll_canvas_left,
    render_scroll_canvas_right,
    get_blocks,
    get_all_blocks,
    export_as_png,
    export_as_apng,
    encode_as_bin,
    encode_as_xbin,
    encode_as_ansi,
    encode_as_mbd,
    remove_ice_color_for_block,
};
