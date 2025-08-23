const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database/database.js');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#121212'
  });

  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

ipcMain.on('get-data', (event, arg) => {
  db.all('SELECT * FROM items', [], (err, rows) => {
    if (err) {
      throw err;
    }
    event.reply('get-data-reply', rows);
  });
});
