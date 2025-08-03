const libtextmode = require("../libtextmode/libtextmode");
const electron = require("electron");
const dev = !electron.app || !electron.app.isPackaged;
const ans_path = dev ? "./build/ans/" : `${process.resourcesPath}/ans/`;

document.addEventListener("DOMContentLoaded", () => {
    libtextmode.animate({
        file: `${ans_path}acknowledgements.xb`,
        ctx: document.getElementById("acknowledgements_terminal").getContext("2d"),
    });
});
