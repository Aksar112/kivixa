const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database/database.js');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

// Folders IPC
ipcMain.handle('get-folders', async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM folders ORDER BY name', [], (err, rows) => {
      if (err) {
        reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('add-folder', async (event, { name, parent_id }) => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO folders (name, parent_id) VALUES (?, ?)', [name, parent_id], function (err) {
      if (err) {
        reject(err);
      }
      resolve({ id: this.lastID, name, parent_id });
    });
  });
});

ipcMain.handle('delete-folder', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM folders WHERE id = ?', [id], function(err) {
            if (err) {
                reject(err);
            }
            resolve({ id });
        });
    });
});

ipcMain.handle('get-folder', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM folders WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });
});


// Notes IPC
ipcMain.handle('get-notes', async (event, folder_id) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT id, title, SUBSTR(content, 1, 50) as preview FROM notes';
    let params = [];
    if (folder_id) {
        query += ' WHERE folder_id = ?';
        params.push(folder_id);
    } else {
        query += ' WHERE folder_id IS NULL';
    }
    query += ' ORDER BY updated_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      }
      resolve(rows);
    });
  });
});

ipcMain.handle('get-recent-notes', async () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, title, SUBSTR(content, 1, 50) as preview FROM notes ORDER BY updated_at DESC LIMIT 10', [], (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
    });
});

ipcMain.handle('add-note', async (event, { title, content, folder_id }) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run('INSERT INTO notes (title, content, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [title, content, folder_id, now, now], function (err) {
      if (err) {
        reject(err);
      }
      resolve({ id: this.lastID, title, content, folder_id });
    });
  });
});

ipcMain.handle('get-note', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM notes WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });
});

ipcMain.handle('update-note', async (event, { id, title, content, folder_id }) => {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        let query = 'UPDATE notes SET updated_at = ?';
        const params = [now];

        if (title !== undefined) {
            query += ', title = ?';
            params.push(title);
        }

        if (content !== undefined) {
            query += ', content = ?';
            params.push(content);
        }

        if (folder_id !== undefined) {
            query += ', folder_id = ?';
            params.push(folder_id);
        }

        query += ' WHERE id = ?';
        params.push(id);

        db.run(query, params, function(err) {
            if (err) {
                reject(err);
            }
            resolve({ id });
        });
    });
});

ipcMain.handle('delete-note', async (event, id) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM notes WHERE id = ?', [id], function(err) {
            if (err) {
                reject(err);
            }
            resolve({ id });
        });
    });
});

ipcMain.handle('update-note-content', async (event, { id, content }) => {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        db.run('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?', [content, now, id], function(err) {
            if (err) {
                reject(err);
            }
            resolve({ id });
        });
    });
});


const fs = require('fs');

// Search IPC

// Search IPC
ipcMain.handle('search-all', async (event, query) => {
    return new Promise((resolve, reject) => {
        const searchQuery = `%${query}%`;
        db.all('SELECT id, title, SUBSTR(content, 1, 50) as preview FROM notes WHERE title LIKE ? OR content LIKE ?', [searchQuery, searchQuery], (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
    });
});

// Tags IPC
ipcMain.handle('add-tag', async (event, name) => {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO tags (name) VALUES (?)', [name], function(err) {
            if (err) {
                // If the tag already exists, we can get it.
                if (err.code === 'SQLITE_CONSTRAINT') {
                    db.get('SELECT * FROM tags WHERE name = ?', [name], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve({ id: this.lastID, name });
            }
        });
    });
});

ipcMain.handle('add-note-tag', async (event, { note_id, tag_id }) => {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', [note_id, tag_id], function(err) {
            if (err) {
                reject(err);
            }
            resolve({ note_id, tag_id });
        });
    });
});

ipcMain.handle('get-note-tags', async (event, note_id) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?', [note_id], (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
    });
});

ipcMain.handle('remove-note-tag', async (event, { note_id, tag_id }) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM note_tags WHERE note_id = ? AND tag_id = ?', [note_id, tag_id], function(err) {
            if (err) {
                reject(err);
            }
            resolve({ note_id, tag_id });
        });
    });
});

// Documentation IPC
ipcMain.handle('get-documentation', async () => {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, 'docs', 'DOCUMENTATION.md'), 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });
});
