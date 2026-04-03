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
  setInteractionMode(mode) {
    return ipcRenderer.invoke("overlay:set-interaction-mode", { mode });
  },
  emitQuickOpenTrigger(point) {
    ipcRenderer.send("overlay:quick-open-trigger", point);
  },
  openExternal(url) {
    return ipcRenderer.invoke("overlay:open-external", { url });
  },
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file) || "";
    } catch {
      return "";
    }
  },
  exportTabDocx(payload) {
    return ipcRenderer.invoke("overlay:export-docx", payload);
  },
  exportTabDocxSaveDialog() {
    return ipcRenderer.invoke("overlay:export-docx-save-dialog");
  }
});
