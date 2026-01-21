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
        notesGrid.innerHTML = '';
        if (!notes || notes.length === 0) {
            notesGrid.innerHTML = '<p style="color:#9ca3af; grid-column: 1/-1; text-align:center; margin-top:2rem;">No notes found. Log in to create and save notes, or just explore the interface!</p>';
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';

            const createdDate = new Date(note.date_posted);
            const updatedDate = new Date(note.date_updated);

            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const createdStr = createdDate.toLocaleDateString([], options);
            const updatedStr = updatedDate.toLocaleDateString([], options);

            // Determine if updated
            const isUpdated = note.date_updated && note.date_updated !== note.date_posted;
            const timeDisplay = isUpdated ? `Updated: ${updatedStr}` : `Created: ${createdStr}`;

            card.innerHTML = `
                <div class="card-header">
                    <h3 class="note-title">${note.title}</h3>
                    <div class="card-actions">
                        <button class="icon-btn edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="icon-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div style="font-size:0.75rem; color:#6b7280; margin-bottom:0.5rem;">${timeDisplay}</div>
                <div class="note-preview">${note.content}</div>
                <div class="card-tags">
                    ${note.tags.map(t => `<span class="tag-badge" data-tag="${t}">#${t}</span>`).join('')}
                </div>
            `;

            // Event Delegation or direct binding
            // Edit
            card.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(note);
            });
            // Delete
            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                handleDelete(note.id);
            });
            // Card click (optional, maybe just open edit?)
            card.addEventListener('click', (e) => {
                // If clicked on tag, don't open modal
                if (e.target.classList.contains('tag-badge')) {
                    const tag = e.target.getAttribute('data-tag');
                    fetchNotes(tag);
                    window.history.pushState({}, '', `/dashboard?tag=${tag}`);
                    return;
                }
                // Don't open if clicked on actions
                if (e.target.closest('.card-actions')) return;

                openEditModal(note);
            });

            notesGrid.appendChild(card);
        });
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
            const content = document.getElementById('contentInput').value;
            const tags = document.getElementById('tagsInput').value;

            const data = { title, content, tags };
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
                    if (res.status === 401) {
                        alert('You must be logged in to save notes.');
                    } else {
                        const errData = await res.json();
                        alert(errData.error || 'Error saving note');
                    }
                }
            } catch (err) { console.error(err); }
        });
    }

    function openEditModal(note) {
        document.getElementById('noteId').value = note.id;
        document.getElementById('titleInput').value = note.title;
        document.getElementById('contentInput').value = note.content;
        document.getElementById('tagsInput').value = note.tags.join(', ');

        document.getElementById('modalTitle').innerText = 'Edit Note';
        if (deleteNoteBtn) {
            deleteNoteBtn.style.display = 'block';
            deleteNoteBtn.onclick = () => handleDelete(note.id);
        }
        noteModal.classList.add('active');
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
        document.getElementById('noteId').value = '';
        document.getElementById('modalTitle').innerText = 'Create Note';
        if (deleteNoteBtn) deleteNoteBtn.style.display = 'none';
    }
});
