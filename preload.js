const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posAPI", {
  printPdf: (html) => {
    console.log("IPC call from renderer");
    return ipcRenderer.invoke("print-receipt-pdf", html);
  }
});