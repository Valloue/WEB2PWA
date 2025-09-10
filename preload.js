const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Fonctions existantes
  openApp: (url) => ipcRenderer.invoke('open-app', url),
  openAppManager: () => ipcRenderer.invoke('open-app-manager'),
  
  // Nouvelles fonctions pour la popup
  onLaunchCode: (callback) => ipcRenderer.on('launch-code', (event, code) => callback(code)),
  createDefaultAppJson: () => ipcRenderer.invoke('createDefaultAppJson'),
  requestImport: () => ipcRenderer.invoke('requestImport')
});