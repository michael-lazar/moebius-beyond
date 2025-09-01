const electron = require("electron");
const remote = require("@electron/remote");
var save_method = "";
var save_destroy_when_done = false;

function ok() {
    let method = save_method;
    let destroy_when_done = save_destroy_when_done;
    let ignore_controlcharacters = true;
    remote.getCurrentWindow().getParentWindow().webContents.send("process_save", {
        method,
        destroy_when_done,
        ignore_controlcharacters,
    });
    remote.getCurrentWindow().close();
}

function cancel() {
    remote.getCurrentWindow().close();
}

document.addEventListener(
    "keydown",
    (event) => {
        if (event.code == "Enter") {
            ok();
        } else if (event.code == "Escape") {
            cancel();
        }
    },
    true
);

document.addEventListener(
    "DOMContentLoaded",
    (event) => {
        document.getElementById("ok").addEventListener("click", (event) => ok(), true);
        document.getElementById("cancel").addEventListener("click", (event) => cancel(), true);
    },
    true
);

document.getElementById("img_cc").src = `${process.resourcesPath}/png/controlcharacters.png`;

electron.ipcRenderer.on("ok", (event) => ok());
electron.ipcRenderer.on("cancel", (event) => cancel());

electron.ipcRenderer.on("get_save_data", (event, { method, destroy_when_done }) => {
    save_method = method;
    save_destroy_when_done = destroy_when_done;
});

//electron.remote.getCurrentWebContents().openDevTools();
