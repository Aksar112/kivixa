const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Notes
    getNotes: (folder_id) => ipcRenderer.invoke('get-notes', folder_id),
    getNote: (id) => ipcRenderer.invoke('get-note', id),
    addNote: (note) => ipcRenderer.invoke('add-note', note),
    updateNote: (note) => ipcRenderer.invoke('update-note', note),
    updateNoteContent: (data) => ipcRenderer.invoke('update-note-content', data),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),

    // Folders
    getFolders: () => ipcRenderer.invoke('get-folders'),
    addFolder: (folder) => ipcRenderer.invoke('add-folder', folder),
    deleteFolder: (id) => ipcRenderer.invoke('delete-folder', id),

    // Load data from main process
    onLoadNotebook: (callback) => ipcRenderer.on('load-notebook', (event, data) => callback(data)),
});