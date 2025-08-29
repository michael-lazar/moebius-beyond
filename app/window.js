const electron = require("electron");
const darwin = process.platform == "darwin";
const menu = require("./menu");
const static_wins = {};
const modal_prefs = {
    maximizable: false,
    resizable: false,
    fullscreenable: false,
    backgroundColor: "#292c33",
};

async function new_win(file, options) {
    return new Promise((resolve) => {
        const win = new electron.BrowserWindow({
            ...options,
            show: false,
            useContentSize: true,
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                contextIsolation: false,
            },
        });
        // Enable @electron/remote for this WebContents (required for Electron 14+)
        require("@electron/remote/main").enable(win.webContents);
        win.on("ready-to-show", (event) => {
            win.show();
            resolve(win);
        });
        win.loadFile(file);
    });
}

async function new_doc() {
    return await new_win("app/html/document.html", {
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 500,
        backgroundColor: "#292c33",
    });
}

async function new_modal(file, window_opts) {
    const win = await new_win(file, { ...window_opts, ...modal_prefs });
    if (!darwin) win.setMenuBarVisibility(false);
    return win;
}

async function static(file, window_opts) {
    if (static_wins[file] && !static_wins[file].isDestroyed()) {
        static_wins[file].focus();
    } else {
        static_wins[file] = await new_win(file, {
            ...window_opts,
            maximizable: false,
            resizable: false,
            fullscreenable: false,
        });
        if (!darwin) static_wins[file].setMenuBarVisibility(false);
        static_wins[file].on("focus", (event) => menu.set_application_menu());
        static_wins[file].on("close", () => delete static_wins[file]);
    }
    return static_wins[file];
}

module.exports = { new_doc, new_modal, static, new_win };
