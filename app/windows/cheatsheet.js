const libtextmode = require("../libtextmode/libtextmode");
const electron = require("electron");
const remote = require("@electron/remote");
const dev = !remote.app.isPackaged;
const ans_path = dev ? "./build/ans/" : `${process.resourcesPath}/ans/`;

document.addEventListener(
    "keydown",
    (event) => {
        if (event.key == "Escape") remote.getCurrentWindow().close();
    },
    true
);

document.addEventListener("DOMContentLoaded", () => {
    libtextmode.animate({
        file: `${ans_path}cheatsheet.ans`,
        ctx: document.getElementById("cheatsheet_terminal").getContext("2d"),
    });
});
