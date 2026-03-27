const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("overlayApi", {
  onConfig(handler) {
    ipcRenderer.on("drag-config", (_event, payload) => {
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
  emitDebugSnapshot(payload) {
    ipcRenderer.send("overlay:debug-snapshot", payload);
  },
  commitHotzone(patch) {
    return ipcRenderer.invoke("overlay:hotzone-commit", patch);
  },
  setTextEditing(editing) {
    return ipcRenderer.invoke("overlay:set-text-editing", { editing });
  },
  setPinned(pinned) {
    return ipcRenderer.invoke("overlay:set-pinned", { pinned });
  },
  setCollapsed(collapsed) {
    return ipcRenderer.invoke("overlay:set-collapsed", { collapsed });
  },
  cycleDisplay() {
    return ipcRenderer.invoke("overlay:cycle-display");
  },
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  }
});
