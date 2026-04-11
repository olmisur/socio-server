// Listas: compra y tareas

function renderList(type) {
  const list = spaceData[type] || [];
  const el = document.getElementById(type + '-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${type === 'compra' ? '🛒' : '✅'}</div><p>Sin ${type === 'compra' ? 'productos' : 'tareas'} por ahora</p></div>`;
    return;
  }
  el.innerHTML = list.map(item => `<div class="list-item${item.done ? ' done' : ''}" onclick="toggleItem('${type}','${item.id}',${!item.done})">
    <div class="item-circle">${item.done ? '<svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5l2.5 2.5L9 3" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</div>
    <div class="item-body"><div class="item-name">${esc(item.name)}</div>${item.addedBy && item.addedBy !== currentUser?.name ? `<div class="item-who">por ${esc(item.addedBy)}</div>` : ''}</div>
    <button class="item-del" onclick="event.stopPropagation();delItem('${type}','${item.id}')">✕</button>
  </div>`).join('');
}

async function toggleItem(type, id, done) {
  try { await api(`/api/data/${currentSpaceId}/${type}/${id}`, 'PATCH', { done }); await loadSpaceData(); renderList(type); } catch (e) { toast('Error'); }
}

async function delItem(type, id) {
  try { await api(`/api/data/${currentSpaceId}/${type}/${id}`, 'DELETE'); await loadSpaceData(); renderList(type); } catch (e) { toast('Error'); }
}

async function addItem(type, name) {
  if (!name.trim()) return false;
  try { await api(`/api/data/${currentSpaceId}/${type}`, 'POST', { name }); await loadSpaceData(); renderList(type); return true; } catch (e) { toast(e.message); return false; }
}

async function clearDone(type) {
  try { await api(`/api/data/${currentSpaceId}/${type}?done=true`, 'DELETE'); await loadSpaceData(); renderList(type); toast('Listo ✓'); } catch (e) {}
}

document.getElementById('compra-add-btn').onclick = async () => {
  const i = document.getElementById('compra-input');
  if (await addItem('compra', i.value)) { i.value = ''; toast('Añadido 🛒'); }
};
document.getElementById('compra-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('compra-add-btn').click(); });

document.getElementById('tareas-add-btn').onclick = async () => {
  const i = document.getElementById('tareas-input');
  if (await addItem('tareas', i.value)) { i.value = ''; toast('Tarea añadida ✅'); }
};
document.getElementById('tareas-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('tareas-add-btn').click(); });
