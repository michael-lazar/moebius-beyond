const doc = require("../doc");
const cursor = require("../tools/cursor");
const { apply_canvas_zoom_transform } = require("./ui");

let interval, render;
let mouse_button = false;

function $(name) {
    return document.getElementById(name);
}

function hide(id) {
    $(id).classList.add("hidden");
}

function show(id) {
    $(id).classList.remove("hidden");
}

function start_blinking() {
    let vis_toggle = false;
    $("ice_color_container").style.display = "none";
    $("blink_off_container").style.removeProperty("display");
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
        if (vis_toggle) {
            $("blink_on_container").style.display = "none";
            $("blink_off_container").style.removeProperty("display");
        } else {
            $("blink_off_container").style.display = "none";
            $("blink_on_container").style.removeProperty("display");
        }
        vis_toggle = !vis_toggle;
    }, 300);
}

function stop_blinking() {
    if (interval) clearInterval(interval);
    $("ice_color_container").style.removeProperty("display");
    $("blink_off_container").style.display = "none";
    $("blink_on_container").style.display = "none";
}

function get_zoom_level() {
    // Get zoom level from ui.js canvas_zoom variable
    const { current_zoom_factor } = require("./ui");
    return current_zoom_factor();
}

function get_preview_zoom_level() {
    const { get_preview_zoom_level } = require("./ui");
    return get_preview_zoom_level();
}

function update_frame() {
    const viewport = $("viewport");
    const view_rect = viewport.getBoundingClientRect();
    const view_frame = $("view_frame");
    const container = $("canvas_container");
    const zoom = get_zoom_level();

    if (render) {
        // Fix scroll bounds at zoom < 1: shrink the container's margin box to match
        // the visually-scaled canvas size so the user can't scroll past the canvas edge.
        const h_margin = render.height * (zoom - 1);
        const w_margin = render.width * (zoom - 1);
        container.style.marginBottom = h_margin < 0 ? `${Math.floor(h_margin)}px` : "";
        container.style.marginRight = w_margin < 0 ? `${Math.floor(w_margin)}px` : "";

        const preview_scale = get_preview_zoom_level();
        const base_width = 260;
        const max_preview_width = base_width * preview_scale;

        let scale_factor = render.width / base_width;
        scale_factor *= zoom;
        scale_factor /= preview_scale;

        const width = Math.min(Math.ceil(view_rect.width / scale_factor), max_preview_width);
        const height = Math.min(
            Math.ceil(view_rect.height / scale_factor),
            render.height / (render.width / max_preview_width)
        );
        const top = Math.ceil(viewport.scrollTop / scale_factor);
        const left = Math.ceil(viewport.scrollLeft / scale_factor);
        const preview = $("preview");
        view_frame.style.width = `${width}px`;
        view_frame.style.height = `${height}px`;
        view_frame.style.top = `${top}px`;
        view_frame.style.left = `${20 + left}px`;
        if (top < preview.scrollTop) preview.scrollTop = top;
        const preview_height = preview.getBoundingClientRect().height;
        if (top > preview_height + preview.scrollTop - height - 2)
            // Cap at `top` so we never scroll past the top of the view frame when
            // the frame is taller than the preview window.
            preview.scrollTop = Math.min(top - preview_height + height + 2, top);

        // Update preview canvas widths based on zoom level
        for (const canvas of render.preview_collection) {
            canvas.style.width = `${max_preview_width}px`;
        }
    }
}

function add(new_render) {
    hide("view_frame");
    const ice_color_container = $("ice_color_container");
    const blink_off_container = $("blink_off_container");
    const blink_on_container = $("blink_on_container");
    const preview = $("preview");
    if (render) {
        for (const canvas of render.ice_color_collection) ice_color_container.removeChild(canvas);
        for (const canvas of render.blink_off_collection) blink_off_container.removeChild(canvas);
        for (const canvas of render.blink_on_collection) blink_on_container.removeChild(canvas);
        for (const canvas of render.preview_collection) preview.removeChild(canvas);
    }
    render = new_render;
    $("canvas_container").style.width = `${render.width}px`;
    $("canvas_container").style.height = `${render.height}px`;
    for (const canvas of render.ice_color_collection) ice_color_container.appendChild(canvas);
    for (const canvas of render.blink_off_collection) blink_off_container.appendChild(canvas);
    for (const canvas of render.blink_on_collection) blink_on_container.appendChild(canvas);
    for (const canvas of render.preview_collection) preview.appendChild(canvas);
    show("view_frame");

    // Re-apply the zoom transform since canvas dimensions may have changed (e.g. resize).
    apply_canvas_zoom_transform();
    update_frame();
}

function update_with_mouse_pos(client_x, client_y) {
    const preview = $("preview");
    const viewport = $("viewport");
    const preview_rect = preview.getBoundingClientRect();
    const viewport_rect = viewport.getBoundingClientRect();
    const x = client_x - preview_rect.left - 20 + preview.scrollLeft;
    const y = client_y - preview_rect.top + preview.scrollTop;
    let scale_factor = render.width / 260;
    scale_factor *= get_zoom_level();
    scale_factor /= get_preview_zoom_level();
    const half_view_width = viewport_rect.width / scale_factor / 2;
    const half_view_height = viewport_rect.height / scale_factor / 2;
    viewport.scrollLeft = Math.floor((x - half_view_width) * scale_factor);
    viewport.scrollTop = Math.floor((y - half_view_height) * scale_factor);
    update_frame();
}

function mouse_down(event) {
    if (event.button == 0) {
        mouse_button = true;
        update_with_mouse_pos(event.clientX, event.clientY);
        $("preview").classList.add("grabbing");
    }
}

function mouse_move(event) {
    if (mouse_button) update_with_mouse_pos(event.clientX, event.clientY);
}

function unregister_button(event) {
    if (mouse_button) {
        mouse_button = false;
        $("preview").classList.remove("grabbing");
    }
}

window.addEventListener(
    "DOMContentLoaded",
    (event) => {
        $("viewport").addEventListener("scroll", (event) => update_frame(), true);
        window.addEventListener(
            "resize",
            (event) => {
                // Re-apply zoom transform since centering depends on viewport dimensions.
                apply_canvas_zoom_transform();
                update_frame();
            },
            true
        );
        $("preview").addEventListener("mousedown", mouse_down, true);
        $("preview").addEventListener("mousemove", mouse_move, true);
        $("preview").addEventListener("mouseup", unregister_button, true);
        $("preview").addEventListener("mouseout", unregister_button, true);
    },
    true
);

function goto_row(row) {
    const rows_in_view = Math.floor($("viewport").getBoundingClientRect().height / doc.font.height);
    $("viewport").scrollTop = (row - Math.floor(rows_in_view / 2)) * doc.font.height;
}

doc.on("render", () => add(doc.render));
doc.on("ice_color", (value) => {
    if (value) {
        start_blinking();
    } else {
        stop_blinking();
    }
});
doc.on("use_9px_font", () => add(doc.render));
doc.on("goto_row", (row_no) => goto_row(row_no));
doc.on("goto_self", () => goto_row(cursor.y));

module.exports = { update_frame, add, get_render: () => render };
