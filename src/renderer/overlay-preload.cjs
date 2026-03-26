const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("overlayApi", {
  onConfig(handler) {
    ipcRenderer.on("drag-config", (_event, payload) => {
      handler(payload);
    });
  },
  onUnsavedHint(handler) {
    ipcRenderer.on("overlay:unsaved-hint", (_event, payload) => {
      handler(payload);
    });
  },
  emitDragPosition(point) {
    ipcRenderer.send("overlay:drag-position", point);
  },
  emitDragEnd() {
    ipcRenderer.send("overlay:drag-end");
  },
  emitHotzonePreview(patch) {
    ipcRenderer.send("overlay:hotzone-preview", patch);
  },
  commitHotzone(patch) {
    return ipcRenderer.invoke("overlay:hotzone-commit", patch);
  },
  setEditMode(editing) {
    return ipcRenderer.invoke("overlay:set-edit-mode", { editing });
  },
  setTextEditing(editing) {
    return ipcRenderer.invoke("overlay:set-text-editing", { editing });
  },
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  }
});
