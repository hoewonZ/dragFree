const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("configApi", {
  getConfig() {
    return ipcRenderer.invoke("config:get");
  },
  saveConfig(nextConfig) {
    return ipcRenderer.invoke("config:save", nextConfig);
  },
  pickFolder() {
    return ipcRenderer.invoke("config:pick-folder");
  },
  isReady() {
    return true;
  },
  onWindowShown(handler) {
    ipcRenderer.on("config:window-shown", () => {
      handler();
    });
  }
});
