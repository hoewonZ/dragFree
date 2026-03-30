const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("panelApi", {
  onConfig(handler) {
    ipcRenderer.on("panel-config", (_event, payload) => {
      handler(payload);
    });
  },
  onActive(handler) {
    ipcRenderer.on("panel-active", (_event, payload) => {
      handler(payload);
    });
  },
  onDropAction(handler) {
    ipcRenderer.on("panel-drop-action", (_event, payload) => {
      handler(payload);
    });
  },
  openConfig() {
    ipcRenderer.send("panel:open-config");
  },
  listChildren(folderPath) {
    return ipcRenderer.invoke("panel:list-children", folderPath);
  },
  emitDragPosition(point) {
    ipcRenderer.send("panel:drag-position", point);
  },
  emitDragEnd() {
    ipcRenderer.send("panel:drag-end");
  },
  emitDropTarget(payload) {
    ipcRenderer.send("panel:drop-target", payload);
  },
  onReset(handler) {
    ipcRenderer.on("panel-reset", () => {
      handler();
    });
  },
  getActiveState() {
    return ipcRenderer.invoke("panel:get-active");
  },
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  }
});
