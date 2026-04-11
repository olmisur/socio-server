// Listas: compra, tareas, recurrentes — con undo en borrado y marcado
const undoQueue = {};

function renderList(type) {
  const list = spaceData[type] || [];
  const el = document.getElementById(type + '-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">${type === 'compra' ? '🛒' : '✅'}</div><p>Sin ${type === 'compra' ? 'productos' : 'tareas'} por ahora</p></div>`;
  } else {
    el.innerHTML = list.map(item => `<div class="list-item${item.done ? ' done' : ''}" onclick="toggleItemWithUndo('${type}','${item.id}',${!item.done})">
      <div class="item-circle">${item.done ? '<svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 5.5l2.5 2.5L9 3" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</div>
      <div class="item-body"><div class="item-name">${esc(item.name)}</div>${item.addedBy && item.addedBy !== currentUser?.name ? `<div class="item-who">por ${esc(item.addedBy)}</div>` : ''}</div>
      <button class="item-del" onclick="event.stopPropagation();deleteItemWithUndo('${type}','${item.id}')">✕</button>
    </div>`).join('');
  }
  if (type === 'tareas') renderRecurrentes();
}

function toggleItemWithUndo(type, id, done) {
  const item = (spaceData[type] || []).find(x => x.id === id);
  if (!item) return;
  const prevDone = item.done;
  item.done = done;
  renderList(type);

  const key = `toggle_${id}`;
  if (undoQueue[key]) clearTimeout(undoQueue[key].timer);

  toastWithUndo(done ? `"${esc(item.name)}" completado` : `"${esc(item.name)}" pendiente`, () => {
    item.done = prevDone;
    renderList(type);
    delete undoQueue[key];
  });

  undoQueue[key] = {
    timer: setTimeout(async () => {
      delete undoQueue[key];
      try {
        await api(`/api/data/${currentSpaceId}/${type}/${id}`, 'PATCH', { done });
      } catch { toast('Error'); item.done = prevDone; renderList(type); }
    }, 4000)
  };
}

function deleteItemWithUndo(type, id) {
  const item = (spaceData[type] || []).find(x => x.id === id);
  if (!item) return;
  spaceData[type] = spaceData[type].filter(x => x.id !== id);
  renderList(type);

  if (undoQueue[id]) clearTimeout(undoQueue[id].timer);

  toastWithUndo(`"${esc(item.name)}" eliminado`, () => {
    spaceData[type] = [...(spaceData[type] || []), item].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    renderList(type);
    delete undoQueue[id];
  });

  undoQueue[id] = {
    timer: setTimeout(async () => {
      delete undoQueue[id];
      try { await api(`/api/data/${currentSpaceId}/${type}/${id}`, 'DELETE'); await loadSpaceData(); }
      catch { toast('Error al eliminar'); }
    }, 4000)
  };
}

async function addItem(type, name) {
  if (!name.trim()) return false;
  try { await api(`/api/data/${currentSpaceId}/${type}`, 'POST', { name }); await loadSpaceData(); renderList(type); return true; }
  catch (e) { toast(e.message); return false; }
}

async function clearDone(type) {
  try { await api(`/api/data/${currentSpaceId}/${type}?done=true`, 'DELETE'); await loadSpaceData(); renderList(type); toast('Listo ✓'); } catch (e) {}
}

// ── Recurrentes ────────────────────────────────────────────────────────────────
const PATTERN_LABELS = { daily: 'Cada día', 'weekly:1': 'Cada lun', 'weekly:2': 'Cada mar', 'weekly:3': 'Cada mié', 'weekly:4': 'Cada jue', 'weekly:5': 'Cada vie', 'weekly:6': 'Cada sáb', 'weekly:0': 'Cada dom' };
function patternLabel(p) {
  if (PATTERN_LABELS[p]) return PATTERN_LABELS[p];
  if (p.startsWith('monthly:')) return `Día ${p.split(':')[1]} c/mes`;
  return p;
}

function renderRecurrentes() {
  const list = (spaceData.recurrentes || []).filter(r => r.type === 'tareas');
  const el = document.getElementById('recurrentes-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0">Sin recordatorios</div>'; return; }
  el.innerHTML = list.map(r =>
    `<div class="recurring-item">
      <span class="recurring-badge">${patternLabel(r.pattern)}</span>
      <span class="recurring-name">${esc(r.name)}</span>
      <button class="item-del" onclick="deleteRecurring('${r.id}')">✕</button>
    </div>`
  ).join('');
}

async function deleteRecurring(id) {
  try { await api(`/api/data/${currentSpaceId}/recurrentes/${id}`, 'DELETE'); await loadSpaceData(); renderList('tareas'); } catch { toast('Error'); }
}

// Apertura del modal de nueva recurrente (la función de guardar está en el modal listener de app.js)
document.getElementById('rec-open-btn').onclick = () => document.getElementById('recurring-modal').classList.add('open');

// Inputs
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
