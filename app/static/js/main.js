document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Sidebar Toggle ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }

    // --- IndexedDB for Offline Sync ---
    const DB_NAME = 'NotesOfflineDB';
    const DB_VERSION = 1;
    let db;

    const dbRequest = indexedDB.open(DB_NAME, DB_VERSION);
    dbRequest.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
            db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
        }
    };
    dbRequest.onsuccess = (e) => { db = e.target.result; };

    function saveOfflineNote(note) {
        if (!db) return;
        const tx = db.transaction('notes', 'readwrite');
        tx.objectStore('notes').add({ ...note, sync_pending: true, local_id: Date.now() });
    }

    async function syncOfflineNotes() {
        if (!db || !navigator.onLine) return;
        const tx = db.transaction('notes', 'readwrite');
        const store = tx.objectStore('notes');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = async () => {
            const notes = getAllRequest.result;
            for (const note of notes) {
                try {
                    const res = await fetch('/notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(note)
                    });
                    if (res.ok) {
                        const deleteTx = db.transaction('notes', 'readwrite');
                        deleteTx.objectStore('notes').delete(note.id);
                    }
                } catch (e) { console.error('Sync failed', e); }
            }
            if (notes.length > 0) fetchNotes();
        };
    }

    window.addEventListener('online', syncOfflineNotes);

    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const icon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

    // Check saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                icon.classList.replace('fa-sun', 'fa-moon');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                icon.classList.replace('fa-moon', 'fa-sun');
            }
        });
    }

    // --- SimpleMDE Init ---
    let simplemde = null;
    if (document.getElementById("contentInput")) {
        simplemde = new SimpleMDE({
            element: document.getElementById("contentInput"),
            spellChecker: false,
            status: false,
            placeholder: "Type your note here... (Markdown supported)"
        });

        // SimpleMDE change event
        simplemde.codemirror.on("change", () => {
            isDirty = true;
        });
    }

    // --- Exit Intent / Unload Warning ---
    // Warn user if they try to leave, to prevent data loss (though this app auto-saves/saves on submit, 
    // it's a requested feature). We only warn if the form is dirty or maybe just general warning as asked.
    // The request says: "give an alert that login or you will lose your data"
    // Since we don't track "guest" state easily here without auth check, and the app requires login for dashboard,
    // this might be intended for the auth pages or generally. 
    // However, for logged-in users, data is saved. 
    // If the user means "Guest users", we aren't handling guest mode. 
    // Assuming this is for general unsaved changes in the modal.
    let isDirty = false;
    const inputs = document.querySelectorAll('#noteForm input, #noteForm textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => isDirty = true);
    });

    window.addEventListener('beforeunload', (e) => {
        if (isDirty && document.getElementById('noteModal').classList.contains('active')) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Login or save to avoid losing data.';
            return e.returnValue;
        }
    });

    // --- Active Link Handling ---
    const navLinks = document.querySelectorAll('.nav-item .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default anchor behavior

            navLinks.forEach(l => l.parentElement.classList.remove('active'));
            link.parentElement.classList.add('active');

            const filter = link.getAttribute('data-filter');
            if (filter === 'all') {
                fetchNotes(); // Reset filter
                // Update URL to /dashboard without query (optional)
                window.history.pushState({}, '', '/dashboard');
            } else if (filter === 'tags') {
                // For now, maybe just show all notes but this could be a tag cloud view
                // The user just requested "Filter notes by tag", which is supported via clicking tags.
                // We'll keep showing all notes or maybe implement a side-panel for tags later.
                fetchNotes();
            }
        });
    });

    // --- Notes Functionality ---
    const notesGrid = document.getElementById('notesGrid');
    if (!notesGrid) return;

    // Reuse existing logic from previous main.js but adapted for new UI classes
    const noteModal = document.getElementById('noteModal');
    const noteForm = document.getElementById('noteForm');
    const createNoteBtn = document.getElementById('createNoteBtn');
    const closeModalBtn = document.getElementById('closeModal');
    const searchInput = document.getElementById('searchInput');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');

    // New element refs
    const reminderInput = document.getElementById('reminderInput');
    const aiSummarizeBtn = document.getElementById('aiSummarizeBtn');
    const aiTagsBtn = document.getElementById('aiTagsBtn');
    const sharingSection = document.getElementById('sharingSection');
    const shareUserInput = document.getElementById('shareUserInput');
    const sharePermissionInput = document.getElementById('sharePermissionInput');
    const shareBtn = document.getElementById('shareBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const exportMdBtn = document.getElementById('exportMdBtn');

    let allNotes = [];

    fetchNotes();

    function fetchNotes(tag = null) {
        let url = '/notes';
        if (tag) {
            url += `?tag=${encodeURIComponent(tag)}`;
        }
        fetch(url)
            .then(res => {
                // If redirected to login page (HTML response) or 401
                if (res.redirected && res.url.includes('login')) {
                    // User not logged in, just return empty []
                    return [];
                }
                if (res.status === 401) {
                    return [];
                }
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    allNotes = data;
                    renderNotes(data);
                    checkReminders(data);
                } else {
                    // Could happen if we returned [] manually or got error
                    allNotes = [];
                    renderNotes([]);
                }
            })
            .catch(err => {
                console.error(err);
                // Render empty state on error
                renderNotes([]);
            });
    }

    function renderNotes(notes) {
        notesGrid.innerHTML = '';
        if (!notes || notes.length === 0) {
            notesGrid.innerHTML = '<p style="color:#9ca3af; grid-column: 1/-1; text-align:center; margin-top:2rem;">No notes found. Log in to create and save notes, or just explore the interface!</p>';
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = `note-card ${note.is_pinned ? 'pinned' : ''}`;

            const createdDate = new Date(note.date_posted);
            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const createdStr = createdDate.toLocaleDateString([], options);

            let renderedContent = '';
            try {
                renderedContent = marked.parse(note.content);
            } catch (e) {
                renderedContent = note.content;
            }

            const isShared = note.permission !== 'owner';

            card.innerHTML = `
                <div class="card-header">
                    <h3 class="note-title">${note.title}</h3>
                    <div class="card-actions">
                        ${isShared ? `<span style="font-size: 0.7rem; opacity: 0.6; margin-right: 0.5rem;" title="Owner: ${note.owner}"><i class="fas fa-users"></i></span>` : ''}
                        <button class="icon-btn pin-btn ${note.is_pinned ? 'active' : ''}" title="${note.is_pinned ? 'Unpin' : 'Pin'}">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                        <button class="icon-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                    </div>
                </div>
                <div style="font-size:0.75rem; color:#6b7280; margin-bottom:0.5rem;">${createdStr} ${note.reminder_date ? `<span style="color:var(--primary-color)" title="Reminder set"><i class="fas fa-bell"></i></span>` : ''}</div>
                <div class="note-preview" style="display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${renderedContent.replace(/<[^>]*>?/gm, '')}</div> 
                <div class="card-tags">
                    ${note.tags.map(t => `<span class="tag-badge" data-tag="${t}">#${t}</span>`).join('')}
                </div>
            `;

            // Pin
            card.querySelector('.pin-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                togglePin(note);
            });

            // Edit
            card.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(note);
            });

            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-badge')) {
                    const tag = e.target.getAttribute('data-tag');
                    fetchNotes(tag);
                    return;
                }
                openEditModal(note);
            });

            notesGrid.appendChild(card);
        });
    }

    async function togglePin(note) {
        const newStatus = !note.is_pinned;
        try {
            const res = await fetch(`/notes/${note.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_pinned: newStatus })
            });
            if (res.ok) {
                fetchNotes();
            }
        } catch (err) { console.error(err); }
    }

    // Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allNotes.filter(note =>
                note.title.toLowerCase().includes(term) ||
                note.content.toLowerCase().includes(term) ||
                note.tags.some(t => t.toLowerCase().includes(term))
            );
            renderNotes(filtered);
        });
    }

    // Modal
    if (createNoteBtn) {
        createNoteBtn.addEventListener('click', () => {
            resetModal();
            noteModal.classList.add('active');
        });
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            noteModal.classList.remove('active');
        });
    }
    // Form Submit
    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('noteId').value;
            const title = document.getElementById('titleInput').value;
            const content = simplemde ? simplemde.value() : document.getElementById('contentInput').value;
            const tags = document.getElementById('tagsInput').value;
            const reminder_date = reminderInput.value;

            const data = { title, content, tags, reminder_date };

            if (!navigator.onLine) {
                saveOfflineNote(data);
                alert('Saved locally. Will sync when online.');
                noteModal.classList.remove('active');
                return;
            }

            let url = '/notes';
            let method = 'POST';

            if (id) {
                url = `/notes/${id}`;
                method = 'PUT';
            }

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (res.redirected && res.url.includes('login')) {
                    alert('You must be logged in to save notes.');
                    return;
                }

                if (res.ok) {
                    noteModal.classList.remove('active');
                    resetModal(); // Reset form
                    isDirty = false; // Reset dirty flag
                    fetchNotes();
                } else {
                    const errData = await res.json();
                    alert(errData.error || 'Error saving note');
                }
            } catch (err) { console.error(err); }
        });
    }

    function openEditModal(note) {
        document.getElementById('noteId').value = note.id;
        document.getElementById('titleInput').value = note.title;
        if (simplemde) {
            simplemde.value(note.content);
        } else {
            document.getElementById('contentInput').value = note.content;
        }
        document.getElementById('tagsInput').value = note.tags.join(', ');
        reminderInput.value = note.reminder_date || '';

        document.getElementById('modalTitle').innerText = 'Edit Note';

        const isOwner = note.permission === 'owner';
        sharingSection.style.display = isOwner ? 'block' : 'none';
        deleteNoteBtn.style.display = isOwner ? 'block' : 'none';
        exportPdfBtn.style.display = 'block';
        exportMdBtn.style.display = 'block';

        if (isOwner) {
            deleteNoteBtn.onclick = () => handleDelete(note.id);
            shareBtn.onclick = () => handleShare(note.id);
        }

        exportPdfBtn.onclick = () => handleExport(note, 'pdf');
        exportMdBtn.onclick = () => handleExport(note, 'md');

        noteModal.classList.add('active');

        // Reset dirty flag after populating (SimpleMDE value change might set it to true)
        setTimeout(() => isDirty = false, 10);
    }

    async function handleDelete(id) {
        if (confirm('Delete this note?')) {
            await fetch(`/notes/${id}`, { method: 'DELETE' });
            noteModal.classList.remove('active');
            fetchNotes();
        }
    }

    function resetModal() {
        noteForm.reset();
        if (simplemde) simplemde.value('');
        document.getElementById('noteId').value = '';
        document.getElementById('modalTitle').innerText = 'Create Note';
        deleteNoteBtn.style.display = 'none';
        sharingSection.style.display = 'none';
        exportPdfBtn.style.display = 'none';
        exportMdBtn.style.display = 'none';
        isDirty = false;
    }

    async function handleShare(id) {
        const username = shareUserInput.value;
        const permission = sharePermissionInput.value;
        if (!username) return alert('Enter a username');

        const res = await fetch(`/notes/${id}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, permission })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            shareUserInput.value = '';
        } else {
            alert(data.error);
        }
    }

    function handleExport(note, format) {
        if (format === 'md') {
            const blob = new Blob([note.content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${note.title}.md`;
            a.click();
        } else if (format === 'pdf') {
            const element = document.createElement('div');
            element.innerHTML = `<h1>${note.title}</h1><div>${marked.parse(note.content)}</div>`;
            html2pdf().from(element).save(`${note.title}.pdf`);
        }
    }

    // AI Tools
    aiSummarizeBtn.onclick = async () => {
        const content = simplemde ? simplemde.value() : document.getElementById('contentInput').value;
        if (!content) return;
        const res = await fetch('/notes/ai-tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, tool: 'summarize' })
        });
        const data = await res.json();
        if (data.result) {
            if (simplemde) simplemde.value(data.result);
            else document.getElementById('contentInput').value = data.result;
        }
    };

    aiTagsBtn.onclick = async () => {
        const content = simplemde ? simplemde.value() : document.getElementById('contentInput').value;
        if (!content) return;
        const res = await fetch('/notes/ai-tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, tool: 'tags' })
        });
        const data = await res.json();
        if (data.result) {
            const currentTags = document.getElementById('tagsInput').value;
            const newTags = [...new Set([...currentTags.split(',').map(t => t.trim()), ...data.result])].filter(t => t).join(', ');
            document.getElementById('tagsInput').value = newTags;
        }
    };

    function checkReminders(notes) {
        const now = new Date();
        notes.forEach(note => {
            if (note.reminder_date) {
                const remDate = new Date(note.reminder_date);
                if (remDate > now && remDate - now < 300000) { // Within 5 mins
                    if (Notification.permission === 'granted') {
                        new Notification(`Reminder: ${note.title}`, { body: 'Your note reminder is due soon!' });
                    } else {
                        console.log(`Reminder coming up for ${note.title}`);
                    }
                }
            }
        });
    }

    // Request Notification Permission
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    // Periodic Sync
    setInterval(() => syncOfflineNotes(), 30000);
});
