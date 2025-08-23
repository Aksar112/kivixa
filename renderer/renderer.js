
window.addEventListener('DOMContentLoaded', () => {
    const folderTree = document.getElementById('folder-tree');
    const addFolderBtn = document.getElementById('add-folder-btn');
    const noteList = document.getElementById('note-list');
    const addNoteBtn = document.getElementById('add-note-btn');
    const noteEditor = document.getElementById('note-editor');
    const noteTitleInput = document.getElementById('note-title-input');
    const noteContentInput = document.getElementById('note-content-input');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    const searchInput = document.getElementById('search-input');
    const recentNotesList = document.getElementById('recent-notes-list');
    const welcomeScreen = document.getElementById('welcome-screen');
    const currentFolderName = document.getElementById('current-folder-name');
    const tagInput = document.getElementById('tag-input');
    const tagsContainer = document.getElementById('tags-container');

    let currentFolderId = null;
    let currentNoteId = null;

    function setActiveItem(list, id) {
        [...list.children].forEach(item => {
            item.classList.toggle('active', item.dataset.id == id);
        });
    }

    async function loadFolders() {
        const folders = await window.electronAPI.getFolders();
        folderTree.innerHTML = '';
        folders.forEach(folder => {
            const folderEl = document.createElement('div');
            folderEl.className = 'folder-item';
            folderEl.textContent = folder.name;
            folderEl.dataset.id = folder.id;
            folderTree.appendChild(folderEl);
        });
        setActiveItem(folderTree, currentFolderId);
    }

    async function loadNotes(folderId) {
        currentFolderId = folderId;
        const notes = await window.electronAPI.getNotes(folderId);
        noteList.innerHTML = '';
        notes.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.className = 'note-item';
            noteEl.dataset.id = note.id;
            noteEl.draggable = true;
            noteEl.innerHTML = `<h4>${note.title}</h4><p>${note.preview}</p>`;
            noteList.appendChild(noteEl);
        });
        const folder = folderId ? await window.electronAPI.getFolder(folderId) : null;
        currentFolderName.textContent = folder ? folder.name : 'All Notes';
        setActiveItem(folderTree, folderId);
        setActiveItem(noteList, currentNoteId);
    }

    async function loadRecentNotes() {
        const notes = await window.electronAPI.getRecentNotes();
        recentNotesList.innerHTML = '';
        notes.forEach(note => {
            const noteEl = document.createElement('li');
            noteEl.textContent = note.title;
            noteEl.dataset.id = note.id;
            recentNotesList.appendChild(noteEl);
        });
    }

    async function loadNoteTags(noteId) {
        const tags = await window.electronAPI.getNoteTags(noteId);
        tagsContainer.innerHTML = '';
        tags.forEach(tag => {
            const tagEl = document.createElement('div');
            tagEl.className = 'tag-item';
            tagEl.textContent = tag.name;
            tagEl.dataset.id = tag.id;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-tag-btn';
            removeBtn.innerHTML = '&times;';
            tagEl.appendChild(removeBtn);
            tagsContainer.appendChild(tagEl);
        });
    }

    async function openNote(noteId) {
        currentNoteId = noteId;
        const note = await window.electronAPI.getNote(noteId);
        if (note) {
            noteTitleInput.value = note.title;
            noteContentInput.value = note.content;
            noteEditor.style.display = 'flex';
            welcomeScreen.style.display = 'none';
            setActiveItem(noteList, currentNoteId);
            loadNoteTags(currentNoteId);
        } else {
            showWelcomeScreen();
        }
    }

    function showWelcomeScreen() {
        noteEditor.style.display = 'none';
        welcomeScreen.style.display = 'flex';
        currentNoteId = null;
    }

    addFolderBtn.addEventListener('click', async () => {
        const name = prompt('Enter folder name:');
        if (name) {
            await window.electronAPI.addFolder({ name, parent_id: null });
            loadFolders();
        }
    });

    folderTree.addEventListener('click', (e) => {
        if (e.target.classList.contains('folder-item')) {
            const folderId = e.target.dataset.id;
            loadNotes(folderId);
            showWelcomeScreen();
        }
    });

    addNoteBtn.addEventListener('click', async () => {
        if (currentFolderId) {
            const newNote = await window.electronAPI.addNote({ title: 'Untitled Note', content: '', folder_id: currentFolderId });
            await loadNotes(currentFolderId);
            openNote(newNote.id);
        } else {
            alert('Please select a folder first.');
        }
    });

    noteList.addEventListener('click', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (noteItem) {
            openNote(noteItem.dataset.id);
        }
    });

    recentNotesList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            openNote(e.target.dataset.id);
        }
    });

    saveNoteBtn.addEventListener('click', async () => {
        if (currentNoteId) {
            await window.electronAPI.updateNote({
                id: currentNoteId,
                title: noteTitleInput.value,
                content: noteContentInput.value
            });
            await loadNotes(currentFolderId);
            await loadRecentNotes();
        }
    });

    deleteNoteBtn.addEventListener('click', async () => {
        if (currentNoteId && confirm('Are you sure you want to delete this note?')) {
            await window.electronAPI.deleteNote(currentNoteId);
            await loadNotes(currentFolderId);
            await loadRecentNotes();
            showWelcomeScreen();
        }
    });

    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length > 2) {
            const notes = await window.electronAPI.searchAll(query);
            noteList.innerHTML = '';
            notes.forEach(note => {
                const noteEl = document.createElement('div');
                noteEl.className = 'note-item';
                noteEl.dataset.id = note.id;
                noteEl.innerHTML = `<h4>${note.title}</h4><p>${note.preview}</p>`;
                noteList.appendChild(noteEl);
            });
            currentFolderName.textContent = `Search Results for "${query}"`;
        } else if (query.length === 0) {
            loadNotes(currentFolderId);
        }
    });

    tagInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && currentNoteId) {
            const tagName = tagInput.value.trim();
            if (tagName) {
                const tag = await window.electronAPI.addTag(tagName);
                await window.electronAPI.addNoteTag({ note_id: currentNoteId, tag_id: tag.id });
                tagInput.value = '';
                loadNoteTags(currentNoteId);
            }
        }
    });

    tagsContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-tag-btn')) {
            const tagId = e.target.parentElement.dataset.id;
            await window.electronAPI.removeNoteTag({ note_id: currentNoteId, tag_id: tagId });
            loadNoteTags(currentNoteId);
        }
    });

    // Drag and Drop
    noteList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('note-item')) {
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        }
    });

    folderTree.addEventListener('dragover', (e) => {
        e.preventDefault();
        const folderItem = e.target.closest('.folder-item');
        if(folderItem) {
            folderItem.style.backgroundColor = 'var(--tertiary-bg)'; // Highlight
        }
    });

    folderTree.addEventListener('dragleave', (e) => {
        const folderItem = e.target.closest('.folder-item');
        if(folderItem) {
            folderItem.style.backgroundColor = ''; // Remove highlight
        }
    });

    folderTree.addEventListener('drop', async (e) => {
        e.preventDefault();
        const folderItem = e.target.closest('.folder-item');
        if(folderItem) {
            folderItem.style.backgroundColor = ''; // Remove highlight
            const noteId = e.dataTransfer.getData('text/plain');
            const folderId = folderItem.dataset.id;
            if (noteId && folderId) {
                await window.electronAPI.updateNote({ id: noteId, folder_id: folderId });
                // Find the note and remove it from the list
                const noteElement = noteList.querySelector(`[data-id="${noteId}"]`);
                if (noteElement) {
                    noteElement.remove();
                }
            }
        }
    });

    // Initial Load
    loadFolders();
    loadNotes(null);
    loadRecentNotes();
    showWelcomeScreen();
});
