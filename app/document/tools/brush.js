const { tools, toolbar } = require("../ui/ui");
const doc = require("../doc");
const mouse = require("../input/mouse");
const keyboard = require("../input/keyboard");
const palette = require("../palette");
const { Overlay } = require("./overlay");
const { on } = require("../../senders");
let enabled = false;
let overlay;
let chunked_undo = true;
let tab_held_down = false;
let last_xy;

tools.on("start", (mode) => {
    enabled = mode == tools.modes.BRUSH;
    if (enabled) {
        toolbar.show_brush();
    } else {
        if (tab_held_down) {
            tab_held_down = false;
        }
        destroy_overlay();
    }
});

function destroy_overlay() {
    if (overlay) {
        overlay.destroy();
        overlay = null;
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {[number, number, number, number][]} segments
 * @param {number} font_width
 * @param {number} cell_height
 * @returns {void}
 */
function draw_brush_outline(ctx, segments, font_width, cell_height) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1;
    for (const [x1, y1, x2, y2] of segments) {
        ctx.moveTo(x1 * font_width + 0.5, y1 * cell_height + 0.5);
        ctx.lineTo(x2 * font_width + 0.5, y2 * cell_height + 0.5);
    }
    ctx.stroke();
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} half_y
 * @returns {void}
 */
function draw_cursor_outline(x, y, half_y) {
    const font = doc.font;
    const { fg, bg } = palette;

    let height_scalar = 1;
    if (toolbar.mode === toolbar.modes.HALF_BLOCK) {
        y = half_y;
        height_scalar = 2;
    }

    // Display the brush outline as long as part of the brush is in-bounds
    const is_legal =
        x >= 1 - Math.ceil(toolbar.brush.size / 2) &&
        x < doc.columns + Math.floor(toolbar.brush.size / 2) &&
        y >= 1 - Math.ceil(toolbar.brush.size / 2) &&
        y < doc.rows * height_scalar + Math.floor(toolbar.brush.size / 2);

    if (!is_legal) {
        destroy_overlay();
        return;
    }

    if (!overlay) {
        overlay = new Overlay();
        overlay.canvas.style.opacity = "1";
    }

    const cell_height = font.height / height_scalar;
    let sx = (x - Math.floor(toolbar.brush.size / 2)) * font.width;
    let sy = (y - Math.floor(toolbar.brush.size / 2)) * cell_height;
    let width = toolbar.brush.size * font.width;
    let height = toolbar.brush.size * cell_height;

    // +1 on each dimension so the right/bottom outline strokes aren't clipped
    width += 1;
    height += 1;

    // Clip overlay bounds to prevent the overlay from being drawn outside of the
    // viewport, which could cause scrollbars to appear on the viewport.
    const viewport = document.getElementById("viewport");
    const canvas_container = document.getElementById("canvas_container");
    const viewport_rect = viewport.getBoundingClientRect();
    const container_rect = canvas_container.getBoundingClientRect();

    const max_right = viewport_rect.right - container_rect.left;
    const max_bottom = viewport_rect.bottom - container_rect.top;

    const clipped_width = Math.min(width, max_right - sx);
    const clipped_height = Math.min(height, max_bottom - sy);

    overlay.update(sx, sy, clipped_width, clipped_height);

    if (toolbar.mode === toolbar.modes.CUSTOM_BLOCK) {
        const half = Math.floor(toolbar.brush.size / 2);
        for (const { x, y } of toolbar.brush.offsets) {
            font.draw(
                overlay.ctx,
                { code: toolbar.custom_block_index, fg, bg },
                (x + half) * font.width,
                (y + half) * font.height
            );
        }
    }

    const segments =
        toolbar.mode === toolbar.modes.HALF_BLOCK
            ? toolbar.brush.half_block_outline_segments
            : toolbar.brush.outline_segments;
    draw_brush_outline(overlay.ctx, segments, font.width, cell_height);
}

function mouse_move(x, y, half_y, is_legal, button, shift_key) {
    if (!enabled) return;
    draw_cursor_outline(x, y, half_y);
}

function mouse_handler(skip_first) {
    return (x, y, half_y, is_legal, button, shift_key) => {
        if (!enabled) return;
        draw_cursor_outline(x, y, half_y);

        if (!chunked_undo || !skip_first) doc.start_undo();
        mouse.start_drawing();
        const { fg, bg } = palette;
        if (toolbar.mode == toolbar.modes.HALF_BLOCK) {
            if (shift_key) {
                toolbar.brush.half_block_line(mouse.x, mouse.half_y, x, half_y, 0, skip_first);
            } else {
                toolbar.brush.half_block_line(
                    mouse.x,
                    mouse.half_y,
                    x,
                    half_y,
                    button == mouse.buttons.LEFT ? fg : bg,
                    skip_first
                );
            }
        } else if (shift_key) {
            toolbar.brush.clear_block_line(mouse.x, mouse.y, x, y);
        } else {
            switch (toolbar.mode) {
                case toolbar.modes.CUSTOM_BLOCK:
                    toolbar.brush.custom_block_line(
                        mouse.x,
                        mouse.y,
                        x,
                        y,
                        toolbar.custom_block_index,
                        fg,
                        bg,
                        skip_first
                    );
                    break;
                case toolbar.modes.SHADING_BLOCK:
                    toolbar.brush.shading_block_line(
                        mouse.x,
                        mouse.y,
                        x,
                        y,
                        fg,
                        bg,
                        button != mouse.buttons.LEFT,
                        skip_first
                    );
                    break;
                case toolbar.modes.REPLACE_COLOR:
                    toolbar.brush.replace_color_line(mouse.x, mouse.y, x, y, fg, bg, skip_first);
                    break;
                case toolbar.modes.BLINK:
                    toolbar.brush.blink_line(
                        mouse.x,
                        mouse.y,
                        x,
                        y,
                        button != mouse.buttons.LEFT,
                        skip_first
                    );
                    break;
                case toolbar.modes.COLORIZE:
                    toolbar.brush.colorize_line(
                        mouse.x,
                        mouse.y,
                        x,
                        y,
                        toolbar.colorize_fg ? fg : undefined,
                        toolbar.colorize_bg ? bg : undefined,
                        skip_first
                    );
                    break;
            }
        }
    };
}

function mouse_up(x, y, half_y, button, single_point, shift_key) {
    if (!enabled) return;
    if (tab_held_down && single_point && last_xy != undefined) {
        const { fg, bg } = palette;
        switch (toolbar.mode) {
            case toolbar.modes.HALF_BLOCK:
                toolbar.brush.half_block_line(
                    last_xy.x,
                    last_xy.half_y,
                    x,
                    half_y,
                    button == mouse.buttons.LEFT ? fg : bg
                );
                break;
            case toolbar.modes.CUSTOM_BLOCK:
                toolbar.brush.custom_block_line(
                    last_xy.x,
                    last_xy.y,
                    x,
                    y,
                    toolbar.custom_block_index,
                    fg,
                    bg
                );
                break;
            case toolbar.modes.SHADING_BLOCK:
                toolbar.brush.shading_block_line(
                    last_xy.x,
                    last_xy.y,
                    x,
                    y,
                    fg,
                    bg,
                    button != mouse.buttons.LEFT
                );
                break;
            case toolbar.modes.REPLACE_COLOR:
                toolbar.brush.replace_color_line(last_xy.x, last_xy.y, x, y, fg, bg);
                break;
            case toolbar.modes.BLINK:
                toolbar.brush.blink_line(last_xy.x, last_xy.y, x, y, button != mouse.buttons.LEFT);
                break;
            case toolbar.modes.COLORIZE:
                toolbar.brush.colorize_line(
                    last_xy.x,
                    last_xy.y,
                    x,
                    y,
                    toolbar.colorize_fg ? fg : undefined,
                    toolbar.colorize_bg ? bg : undefined
                );
                break;
        }
    }
    last_xy = { x, y, half_y };
}

on("chunked_undo", (event, value) => {
    chunked_undo = value;
});

document.addEventListener(
    "keydown",
    (event) => {
        if (!enabled) return;
        if (event.code == "Tab") tab_held_down = true;
    },
    true
);

document.addEventListener(
    "keyup",
    (event) => {
        if (!enabled) return;
        if (event.code == "Tab") tab_held_down = false;
    },
    true
);

mouse.on("down", mouse_handler(false));
mouse.on("draw", mouse_handler(true));
mouse.on("up", mouse_up);
mouse.on("move", mouse_move);
mouse.on("out", () => {
    if (!enabled) return;
    destroy_overlay();
});

function select_attribute() {
    if (!enabled) return;
    palette.select_attribute();
}

keyboard.on("escape", () => select_attribute());
on("select_attribute", (event) => select_attribute());

keyboard.on("f_key", (num) => {
    if (!enabled) return;
    toolbar.change_custom_brush(num);
});
