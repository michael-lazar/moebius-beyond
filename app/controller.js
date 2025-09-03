const electron = require("electron");
const { on, send, send_sync, msg_box, save_box } = require("./senders");
const doc = require("./document/doc");
const { tools } = require("./document/ui/ui");
const { HourlySaver } = require("./hourly_saver");
let hourly_saver, backup_folder;
require("./document/ui/canvas");
require("./document/tools/select");
require("./document/tools/brush");
require("./document/tools/shifter");
require("./document/tools/line");
require("./document/tools/rectangle_filled");
require("./document/tools/rectangle_outline");
require("./document/tools/ellipse_filled");
require("./document/tools/ellipse_outline");
require("./document/tools/fill");
require("./document/tools/sample");
require("./document/tools/reference");
require("./document/input/drag_and_drop");

doc.on("start_rendering", () => send_sync("show_rendering_modal"));
doc.on("end_rendering", () => send("close_modal"));
doc.on("ready", () => {
    send("ready");
    tools.start(tools.modes.SELECT);
});

async function process_save(
    method = "save",
    destroy_when_done = false,
    ignore_controlcharacters = true
) {
    if (doc.has_control_characters() && ignore_controlcharacters == false) {
        send("show_controlcharacters", { method, destroy_when_done });
    } else {
        switch (method) {
            case "save_as":
                save_as(destroy_when_done);
                break;
            case "save_without_sauce":
                save_without_sauce();
                break;
            default:
                save(destroy_when_done);
                break;
        }
    }
}

function save(destroy_when_done = false, save_without_sauce = false) {
    if (doc.file) {
        doc.edited = false;
        doc.save(save_without_sauce);
        if (destroy_when_done) send("destroy");
    } else {
        save_as(destroy_when_done);
    }
}

async function save_as(destroy_when_done = false) {
    const file = save_box(doc.file, "xb", {
        filters: [
            { name: "XBin", extensions: ["xb"] },
            { name: "Moebius Beyond Document", extensions: ["mbd"] },
            {
                name: "ANSI Art",
                extensions: ["ans", "asc", "diz", "nfo", "txt"],
            },
            { name: "Binary Text", extensions: ["bin"] },
        ],
    });
    if (!file) return;
    doc.file = file;
    doc.edited = false;
    save(destroy_when_done);
    send("set_file", { file: doc.file });
}

async function save_without_sauce() {
    const file = save_box(doc.file, "xb", {
        filters: [
            { name: "XBin", extensions: ["xb"] },
            {
                name: "ANSI Art",
                extensions: ["ans", "asc", "diz", "nfo", "txt"],
            },
            { name: "Binary Text", extensions: ["bin"] },
        ],
    });
    if (!file) return;
    doc.file = file;
    doc.edited = false;
    save(false, true);
    send("set_file", { file: doc.file });
}

async function export_font() {
    const font_height = String(doc.font_height).padStart(2, "0");
    const file = save_box(doc.file, `F${font_height}`, {
        filters: [{ name: "VGA font", extensions: [`F${font_height}`] }],
    });
    if (file) await doc.export_font(file);
}

async function share_online() {
    const url = await doc.share_online();
    if (url) electron.shell.openExternal(url);
}

async function share_online_xbin() {
    const url = await doc.share_online_xbin();
    if (url) electron.shell.openExternal(url);
}

function check_before_closing() {
    const choice = msg_box("Save this document?", "This document contains unsaved changes.", {
        buttons: ["Save", "Cancel", "Don't Save"],
        defaultId: 0,
        cancelId: 1,
    });
    if (choice == 0) {
        save(true);
    } else if (choice == 2) {
        send("destroy");
    }
}

function export_as_utf8() {
    const file = save_box(doc.file, "utf8ans", {
        filters: [{ name: "ANSI Art ", extensions: ["utf8ans"] }],
    });
    if (file) doc.export_as_utf8(file);
}

function export_as_png() {
    const file = save_box(doc.file, "png", {
        filters: [{ name: "Portable Network Graphics ", extensions: ["png"] }],
    });
    if (file) doc.export_as_png(file);
}

function export_as_apng() {
    const file = save_box(doc.file, "png", {
        filters: [
            {
                name: "Animated Portable Network Graphics ",
                extensions: ["png"],
            },
        ],
    });
    if (file) doc.export_as_apng(file);
}

function hourly_save() {
    const file = doc.file ? doc.file : "Untitled.ans";
    const timestamped_file = hourly_saver.filename(backup_folder, file);
    doc.save_backup(timestamped_file);
    hourly_saver.keep_if_changes(timestamped_file);
}

function use_backup(value) {
    if (value) {
        hourly_saver = new HourlySaver();
        hourly_saver.start();
        hourly_saver.on("save", hourly_save);
    } else if (hourly_saver) {
        hourly_saver.stop();
    }
}

on("new_document", (event, opts) => doc.new_document(opts));
on("revert_to_last_save", (event, opts) => doc.open(doc.file));
on("show_file_in_folder", (event, opts) => electron.shell.showItemInFolder(doc.file));
on("duplicate", (event, opts) => doc.duplicate());
on("process_save", (event, { method, destroy_when_done, ignore_controlcharacters }) =>
    process_save(method, destroy_when_done, ignore_controlcharacters)
);
on("save", (event, opts) => process_save("save"));
on("save_as", (event, opts) => process_save("save_as"));
on("save_without_sauce", (event, opts) => process_save("save_without_sauce"));
on("share_online", (event, opts) => share_online());
on("open_file", (event, file) => doc.open(file));
on("check_before_closing", (event) => check_before_closing());
on("share_online_xbin", (event, opts) => share_online_xbin());
on("export_font", (event, opts) => export_font());
on("export_as_utf8", (event) => export_as_utf8());
on("export_as_png", (event) => export_as_png());
on("export_as_apng", (event) => export_as_apng());
on("remove_ice_colors", (event) => doc.remove_ice_colors());
on("backup_folder", (event, folder) => {
    backup_folder = folder;
});
on("use_backup", (event, value) => use_backup(value));
