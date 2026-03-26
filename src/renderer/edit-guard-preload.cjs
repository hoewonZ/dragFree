const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("guardApi", {
  onConfig(handler) {
    ipcRenderer.on("guard-config", (_event, payload) => {
      handler(payload);
    });
  },
  onShowConfirm(handler) {
    ipcRenderer.on("guard:show-confirm", (_event, payload) => {
      handler(payload);
    });
  },
  emitUnsavedAttempt(payload) {
    ipcRenderer.send("overlay:unsaved-attempt", payload);
  },
  lockAndSave() {
    return ipcRenderer.invoke("overlay:lock-and-save");
  }
});
