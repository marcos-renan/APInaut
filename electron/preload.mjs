import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("apinautDesktop", {
  isDesktop: true,
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  onMaximizeChange: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_, isMaximized) => callback(Boolean(isMaximized));
    ipcRenderer.on("window:maximized", listener);

    return () => {
      ipcRenderer.removeListener("window:maximized", listener);
    };
  },
});
