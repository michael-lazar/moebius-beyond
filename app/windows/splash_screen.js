const libtextmode = require("../libtextmode/libtextmode");
const electron = require("electron");
const dev = require("electron-is-dev");
const ans_path = dev ? "./build/ans/" : `${process.resourcesPath}/ans/`;

document.addEventListener("DOMContentLoaded", () => {
    const preferences = document.getElementById("preferences");
    if (process.platform != "darwin") preferences.innerText = "Settings";
    document
        .getElementById("new_document")
        .addEventListener("click", (event) => electron.ipcRenderer.send("new_document"));
    document
        .getElementById("open")
        .addEventListener("click", (event) => electron.ipcRenderer.send("open"));
    preferences.addEventListener("click", (event) => electron.ipcRenderer.send("preferences"));
    libtextmode.animate({
        file: `${ans_path}mozz-moebiusX.xb`,
        ctx: document.getElementById("splash_terminal").getContext("2d"),
    });
});
