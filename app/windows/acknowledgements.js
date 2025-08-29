const libtextmode = require("../libtextmode/libtextmode");
require("electron");
const remote = require("@electron/remote");
const dev = !remote.app.isPackaged;
const ans_path = dev ? "./build/ans/" : `${process.resourcesPath}/ans/`;

document.addEventListener("DOMContentLoaded", () => {
    libtextmode.animate({
        file: `${ans_path}acknowledgements.xb`,
        ctx: document.getElementById("acknowledgements_terminal").getContext("2d"),
    });
});
