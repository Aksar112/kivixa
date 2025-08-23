const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getData: () => ipcRenderer.send('get-data'),
  receiveData: (func) => {
    ipcRenderer.on('get-data-reply', (event, ...args) => func(...args));
  }
});
