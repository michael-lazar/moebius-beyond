const doc = require("../doc");
const { BRUSH_SHAPES, parse_brush_shape, compute_outline_segments } = require("./brush_shapes");

function line(x0, y0, x1, y1, skip_first = false) {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = (dx > dy ? dx : -dy) / 2;
    let e2;
    const coords = [];
    while (true) {
        coords.push({ x: x0, y: y0 });
        if (x0 == x1 && y0 == y1) break;
        e2 = err;
        if (e2 > -dx) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dy) {
            err += dx;
            y0 += sy;
        }
    }
    if (skip_first && coords.length > 1) coords.shift();
    return coords;
}

function shading_block(x, y, fg, bg, reduce) {
    const block = doc.at(x, y);
    if (block) {
        if (reduce) {
            switch (block.code) {
                case 176:
                    doc.change_data(x, y, 32, fg, bg);
                    break;
                case 177:
                    doc.change_data(x, y, 176, fg, bg);
                    break;
                case 178:
                    doc.change_data(x, y, 177, fg, bg);
                    break;
                case 219:
                    if (block.fg == fg) doc.change_data(x, y, 178, fg, bg);
                    break;
            }
        } else {
            switch (block.code) {
                case 219:
                    if (block.fg != fg) doc.change_data(x, y, 176, fg, bg);
                    break;
                case 178:
                    doc.change_data(x, y, 219, fg, bg);
                    break;
                case 177:
                    doc.change_data(x, y, 178, fg, bg);
                    break;
                case 176:
                    doc.change_data(x, y, 177, fg, bg);
                    break;
                default:
                    doc.change_data(x, y, 176, fg, bg);
                    break;
            }
        }
    }
}

class Brush {
    /** @type {number} */
    custom_block_index;

    /**
     * @param {number} [size=1]
     * @param {number} [custom_block_index=176]
     * @param {string} [shape="round"]
     */
    constructor(size = 1, custom_block_index = 176, shape = "round") {
        this._size = size;
        this._shape = shape;
        this.custom_block_index = custom_block_index;
    }

    /** @returns {number} */
    get size() {
        return this._size;
    }

    /** @param {number} v */
    set size(v) {
        this._size = v;
        this._offsets = null;
        this._outline_segments = null;
    }

    /** @returns {string} */
    get shape() {
        return this._shape;
    }

    /** @param {string} v */
    set shape(v) {
        this._shape = v;
        this._offsets = null;
        this._outline_segments = null;
    }

    /** @returns {void} */
    _recompute() {
        const ascii = BRUSH_SHAPES[this._shape][this._size - 1];
        this._offsets = parse_brush_shape(ascii);
        this._outline_segments = compute_outline_segments(
            this._offsets,
            Math.floor(this._size / 2)
        );
    }

    /** @returns {{ x: number, y: number }[]} */
    get offsets() {
        if (!this._offsets) this._recompute();
        return this._offsets;
    }

    /** @returns {[number, number, number, number][]} */
    get outline_segments() {
        if (!this._outline_segments) this._recompute();
        return this._outline_segments;
    }

    half_block_line(sx, sy, dx, dy, col, skip_first) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                doc.set_half_block(coord.x + x, coord.y + y, col);
            }
        }
    }

    custom_block_line(sx, sy, dx, dy, fg, bg, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                doc.change_data(coord.x + x, coord.y + y, this.custom_block_index, fg, bg);
            }
        }
    }

    shading_block_line(sx, sy, dx, dy, fg, bg, reduce, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                shading_block(coord.x + x, coord.y + y, fg, bg, reduce);
            }
        }
    }

    clear_block_line(sx, sy, dx, dy, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                doc.change_data(coord.x + x, coord.y + y, 32, 7, 0);
            }
        }
    }

    replace_color_line(sx, sy, dx, dy, to, from, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                const block = doc.at(coord.x + x, coord.y + y);
                if (block && (block.fg == from || block.bg == from))
                    doc.change_data(
                        coord.x + x,
                        coord.y + y,
                        block.code,
                        block.fg == from ? to : block.fg,
                        block.bg == from ? to : block.bg
                    );
            }
        }
    }

    blink_line(sx, sy, dx, dy, unblink, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                const block = doc.at(coord.x + x, coord.y + y);
                if (
                    block &&
                    ((!unblink && block.bg < 8) || (unblink && block.bg > 7 && block.bg < 16)) &&
                    block.code !== 0 &&
                    block.code !== 32 &&
                    block.code !== 255
                )
                    doc.change_data(
                        coord.x + x,
                        coord.y + y,
                        block.code,
                        block.fg,
                        unblink ? block.bg - 8 : block.bg + 8
                    );
            }
        }
    }

    colorize_line(sx, sy, dx, dy, fg, bg, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                const block = doc.at(coord.x + x, coord.y + y);
                if (block)
                    doc.change_data(
                        coord.x + x,
                        coord.y + y,
                        block.code,
                        fg != undefined ? fg : block.fg,
                        bg != undefined ? bg : block.bg
                    );
            }
        }
    }
}

function single_half_block_line(sx, sy, dx, dy, col, skip_first) {
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords) doc.set_half_block(coord.x, coord.y, col);
}

function single_custom_block_line(sx, sy, dx, dy, fg, bg, skip_first = false) {
    // Inline require to avoid circular dependency with ui.js
    const { toolbar } = require("../ui/ui");
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords)
        doc.change_data(coord.x, coord.y, toolbar.brush.custom_block_index, fg, bg);
}

function single_shading_block_line(sx, sy, dx, dy, fg, bg, reduce, skip_first = false) {
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords) shading_block(coord.x, coord.y, fg, bg, reduce);
}

function single_clear_block_line(sx, sy, dx, dy, skip_first = false) {
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords) doc.change_data(coord.x, coord.y, 32, 7, 0);
}

function single_replace_color_line(sx, sy, dx, dy, to, from, skip_first = false) {
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords) {
        const block = doc.at(coord.x, coord.y);
        if (block && (block.fg == from || block.bg == from))
            doc.change_data(
                coord.x,
                coord.y,
                block.code,
                block.fg == from ? to : block.fg,
                block.bg == from ? to : block.bg
            );
    }
}

function single_blink_line(sx, sy, dx, dy, unblink, skip_first = false) {
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords) {
        const block = doc.at(coord.x, coord.y);
        if (
            block &&
            ((!unblink && block.bg < 8) || (unblink && block.bg > 7 && block.bg < 15)) &&
            block.code !== 0 &&
            block.code !== 32 &&
            block.code !== 255
        )
            doc.change_data(
                coord.x,
                coord.y,
                block.code,
                block.fg,
                unblink ? block.bg - 8 : block.bg + 8
            );
    }
}

function single_colorize_line(sx, sy, dx, dy, fg, bg, skip_first = false) {
    const coords = line(sx, sy, dx, dy, skip_first);
    for (const coord of coords) {
        const block = doc.at(coord.x, coord.y);
        if (block)
            doc.change_data(
                coord.x,
                coord.y,
                block.code,
                fg != undefined ? fg : block.fg,
                bg != undefined ? bg : block.bg
            );
    }
}

module.exports = {
    Brush,
    single_half_block_line,
    single_custom_block_line,
    shading_block,
    single_shading_block_line,
    single_clear_block_line,
    single_replace_color_line,
    single_blink_line,
    single_colorize_line,
    line,
};
