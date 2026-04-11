// Notas rápidas: listado y editor

function renderNotas() {
  const el = document.getElementById('notas-list');
  const list = spaceData.notas || [];
  if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>Sin notas. ¡Escribe algo!</p></div>'; return; }
  el.innerHTML = [...list].reverse().map(nota =>
    `<div class="note-item" onclick="openNote('${nota.id}')">
      <div class="note-title">${esc(nota.title) || 'Sin título'}</div>
      <div class="note-body-prev">${esc(nota.body)}</div>
      <div class="note-date">${nota.date}${nota.createdBy && nota.createdBy !== currentUser?.name ? ' · ' + esc(nota.createdBy) : ''}</div>
    </div>`
  ).join('');
}

function openNote(id) {
  editNoteId = id;
  const n = id ? spaceData.notas.find(x => x.id === id) : null;
  document.getElementById('note-title-input').value = n?.title || '';
  document.getElementById('note-body-input').value = n?.body || '';
  document.getElementById('note-editor').classList.add('open');
}

document.getElementById('note-back').onclick = () => document.getElementById('note-editor').classList.remove('open');

document.getElementById('save-note-btn').onclick = async () => {
  const title = document.getElementById('note-title-input').value;
  const body = document.getElementById('note-body-input').value;
  if (!title.trim() && !body.trim()) { toast('La nota está vacía'); return; }
  try {
    if (editNoteId) {
      await api(`/api/data/${currentSpaceId}/notas/${editNoteId}`, 'PUT', { title, body });
    } else {
      await api(`/api/data/${currentSpaceId}/notas`, 'POST', { title, body });
    }
    await loadSpaceData();
    renderNotas();
    document.getElementById('note-editor').classList.remove('open');
    toast('Nota guardada 📝');
  } catch (e) { toast('Error'); }
};
