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

    // --- Active Link Handling ---
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            // Filter logic can go here (e.g., show only favorites)
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

    function fetchNotes() {
        fetch('/notes')
            .then(res => {
                if (res.status === 401) window.location.href = '/login';
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    allNotes = data;
                    renderNotes(data);
                }
            })
            .catch(err => console.error(err));
    }

    function renderNotes(notes) {
        notesGrid.innerHTML = '';
        if (notes.length === 0) {
            notesGrid.innerHTML = '<p style="color:#9ca3af; grid-column: 1/-1; text-align:center; margin-top:2rem;">No notes found. Create one!</p>';
            return;
        }

        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';

            // Format time (e.g. 3:30 PM)
            // note.date_posted comes as YYYY-MM-DD HH:MM
            const dateObj = new Date(note.date_posted);
            let timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            card.innerHTML = `
                <div class="card-header">
                    <h3 class="note-title">${note.title}</h3>
                    <span class="note-time">${timeStr}</span>
                </div>
                <div class="note-preview">${note.content}</div>
                <div class="card-tags">
                    ${note.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('')}
                </div>
            `;
            card.addEventListener('click', () => openEditModal(note));
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
                if (res.ok) {
                    noteModal.classList.remove('active');
                    fetchNotes();
                } else {
                    alert('Error saving note');
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
