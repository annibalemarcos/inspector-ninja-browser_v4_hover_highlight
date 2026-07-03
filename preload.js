const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getWebviewInfo: () => ipcRenderer.invoke('get-webview-info'),

  // Usa o clipboard nativo do Electron via processo principal.
  // O navigator.clipboard costuma falhar em file:// / webviews / contextIsolation,
  // então aqui é o caminho blindado, sem frescura e sem drama.
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard-write', text === undefined || text === null ? '' : String(text))
});
