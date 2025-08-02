const libtextmode = require("../libtextmode/libtextmode");
const electron = require("electron");
const dev = !electron.app || !electron.app.isPackaged;
const ans_path = dev ? "./build/ans/" : `${process.resourcesPath}/ans/`;

document.addEventListener("DOMContentLoaded", () => {
    libtextmode.animate({
        file: `${ans_path}numpad_mappings.ans`,
        ctx: document.getElementById("numpad_mappings_terminal").getContext("2d"),
    });
});
