const doc = require("../doc");
const { BRUSH_SHAPES, parse_brush_shape, compute_outline_segments } = require("./brush_shapes");

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {boolean} [skip_first=false]
 * @returns {{ x: number, y: number }[]}
 */
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

/**
 * @param {number} x
 * @param {number} y
 * @param {number} fg
 * @param {number} bg
 * @param {boolean} reduce
 */
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
    /**
     * @param {number} [size=1]
     * @param {string} [shape="square"]
     */
    constructor(size = 1, shape = "square") {
        this._size = size;
        this._shape = shape;
        this._recompute();
    }

    /** @returns {void} */
    _recompute() {
        const half = Math.floor(this._size / 2);
        this.offsets = parse_brush_shape(BRUSH_SHAPES[this._shape].full[this._size - 1]);
        this.half_block_offsets = parse_brush_shape(BRUSH_SHAPES[this._shape].half[this._size - 1]);
        this.outline_segments = compute_outline_segments(this.offsets, half);
        this.half_block_outline_segments = compute_outline_segments(this.half_block_offsets, half);
    }

    /** @returns {number} */
    get size() {
        return this._size;
    }

    /** @param {number} v */
    set size(v) {
        this._size = v;
        this._recompute();
    }

    /** @returns {string} */
    get shape() {
        return this._shape;
    }

    /** @param {string} v */
    set shape(v) {
        this._shape = v;
        this._recompute();
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} col
     * @param {boolean} [skip_first]
     */
    half_block_line(sx, sy, dx, dy, col, skip_first) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.half_block_offsets) {
                doc.set_half_block(coord.x + x, coord.y + y, col);
            }
        }
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} code
     * @param {number} fg
     * @param {number} bg
     * @param {boolean} [skip_first=false]
     */
    custom_block_line(sx, sy, dx, dy, code, fg, bg, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                doc.change_data(coord.x + x, coord.y + y, code, fg, bg);
            }
        }
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} fg
     * @param {number} bg
     * @param {boolean} reduce
     * @param {boolean} [skip_first=false]
     */
    shading_block_line(sx, sy, dx, dy, fg, bg, reduce, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                shading_block(coord.x + x, coord.y + y, fg, bg, reduce);
            }
        }
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {boolean} [skip_first=false]
     */
    clear_block_line(sx, sy, dx, dy, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) {
            for (const { x, y } of this.offsets) {
                doc.change_data(coord.x + x, coord.y + y, 32, 7, 0);
            }
        }
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} to
     * @param {number} from
     * @param {boolean} [skip_first=false]
     */
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

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {boolean} unblink
     * @param {boolean} [skip_first=false]
     */
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

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} [fg]
     * @param {number} [bg]
     * @param {boolean} [skip_first=false]
     */
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

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} col
     * @param {boolean} [skip_first]
     */
    single_half_block_line(sx, sy, dx, dy, col, skip_first) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) doc.set_half_block(coord.x, coord.y, col);
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} code
     * @param {number} fg
     * @param {number} bg
     * @param {boolean} [skip_first=false]
     */
    single_custom_block_line(sx, sy, dx, dy, code, fg, bg, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) doc.change_data(coord.x, coord.y, code, fg, bg);
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} fg
     * @param {number} bg
     * @param {boolean} reduce
     * @param {boolean} [skip_first=false]
     */
    single_shading_block_line(sx, sy, dx, dy, fg, bg, reduce, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) shading_block(coord.x, coord.y, fg, bg, reduce);
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {boolean} [skip_first=false]
     */
    single_clear_block_line(sx, sy, dx, dy, skip_first = false) {
        const coords = line(sx, sy, dx, dy, skip_first);
        for (const coord of coords) doc.change_data(coord.x, coord.y, 32, 7, 0);
    }

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} to
     * @param {number} from
     * @param {boolean} [skip_first=false]
     */
    single_replace_color_line(sx, sy, dx, dy, to, from, skip_first = false) {
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

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {boolean} unblink
     * @param {boolean} [skip_first=false]
     */
    single_blink_line(sx, sy, dx, dy, unblink, skip_first = false) {
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

    /**
     * @param {number} sx
     * @param {number} sy
     * @param {number} dx
     * @param {number} dy
     * @param {number} [fg]
     * @param {number} [bg]
     * @param {boolean} [skip_first=false]
     */
    single_colorize_line(sx, sy, dx, dy, fg, bg, skip_first = false) {
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
}

module.exports = {
    Brush,
    shading_block,
    line,
};
