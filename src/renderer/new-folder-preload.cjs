const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("newFolderApi", {
  submit(folderName) {
    ipcRenderer.send("new-folder:submit", folderName);
  },
  cancel() {
    ipcRenderer.send("new-folder:cancel");
  },
  onInit(handler) {
    ipcRenderer.on("new-folder:init", (_event, payload) => {
      handler(payload);
    });
  },
  onConflict(handler) {
    ipcRenderer.on("new-folder:conflict", (_event, payload) => {
      handler(payload);
    });
  }
});
