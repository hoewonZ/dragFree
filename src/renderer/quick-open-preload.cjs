const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quickOpenApi", {
  onConfig(handler) {
    ipcRenderer.on("quick-open-config", (_event, payload) => {
      handler(payload);
    });
  },
  onReset(handler) {
    ipcRenderer.on("quick-open-reset", () => {
      handler();
    });
  },
  listChildren(folderPath) {
    return ipcRenderer.invoke("folders:list-children", folderPath);
  },
  openPath(targetPath) {
    return ipcRenderer.invoke("quick-open:open-path", targetPath);
  },
  close() {
    ipcRenderer.send("quick-open:close");
  }
});
