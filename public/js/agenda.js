// Agenda: renderizado, modal de evento (crear/editar) y notificaciones push por evento

function getClientTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'; } catch (e) { return 'Europe/Madrid'; }
}

function renderAgenda() {
  const el = document.getElementById('agenda-list');
  const list = spaceData.agenda || [];
  if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Sin eventos. ¡Añade uno!</p></div>'; return; }
  const sorted = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const today = new Date().toISOString().slice(0, 10);
  const groups = {};
  sorted.forEach(ev => { if (!groups[ev.date]) groups[ev.date] = []; groups[ev.date].push(ev); });
  el.innerHTML = Object.entries(groups).map(([date, evs]) => {
    const d = new Date(date + 'T12:00:00');
    const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<div><div class="date-label${date === today ? ' today' : ''}">${label}</div>${evs.map(ev => {
      const hasNotif = !!ev.notifyEnabled;
      return `<div class="event-item">
        <div class="event-time">${ev.time || '—'}</div>
        <div class="event-body" onclick="openEventModal('${ev.id}')">
          <div class="event-title">${esc(ev.title)}</div>
          ${ev.note ? `<div class="event-note">${esc(ev.note)}</div>` : ''}
        </div>
        <button onclick="toggleEventNotif('${currentSpaceId}','${ev.id}',this)" data-active="${hasNotif}" style="font-size:16px;background:none;border:none;cursor:pointer;opacity:${hasNotif ? 1 : 0.4};margin-right:4px" title="${hasNotif ? 'Cancelar aviso' : 'Activar aviso 30min antes'}">${hasNotif ? '🔔' : '🔕'}</button>
        <button class="event-del" onclick="delEvent('${ev.id}')">✕</button>
      </div>`;
    }).join('')}</div>`;
  }).join('');
}

async function delEvent(id) {
  try { await api(`/api/data/${currentSpaceId}/agenda/${id}`, 'DELETE'); await loadSpaceData(); renderAgenda(); } catch (e) {}
}

function resetEventModal() {
  editEventId = null;
  document.getElementById('event-modal-title').textContent = 'Nuevo evento';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ev-time').value = '';
  document.getElementById('ev-note').value = '';
}

function openEventModal(id) {
  const ev = id ? spaceData.agenda.find(x => x.id === id) : null;
  editEventId = ev?.id || null;
  document.getElementById('event-modal-title').textContent = editEventId ? 'Editar evento' : 'Nuevo evento';
  document.getElementById('ev-title').value = ev?.title || '';
  document.getElementById('ev-date').value = ev?.date || new Date().toISOString().slice(0, 10);
  document.getElementById('ev-time').value = ev?.time || '';
  document.getElementById('ev-note').value = ev?.note || '';
  document.getElementById('event-modal').classList.add('open');
}

async function saveEvent(title, date, time, note) {
  if (!title || !date) return false;
  try {
    if (editEventId) {
      await api(`/api/data/${currentSpaceId}/agenda/${editEventId}`, 'PUT', { title, date, time, note, timeZone: getClientTimeZone() });
    } else {
      await api(`/api/data/${currentSpaceId}/agenda`, 'POST', { title, date, time, note, timeZone: getClientTimeZone() });
    }
    await loadSpaceData();
    renderAgenda();
    return true;
  } catch (e) { toast(e.message); return false; }
}

async function addEvent(title, date, time, note) {
  const prevEditEventId = editEventId;
  editEventId = null;
  const ok = await saveEvent(title, date, time, note);
  editEventId = prevEditEventId;
  return ok;
}

const eventModal = document.getElementById('event-modal');
document.getElementById('modal-cancel').onclick = () => { eventModal.classList.remove('open'); resetEventModal(); };
document.getElementById('modal-save').onclick = async () => {
  const title = document.getElementById('ev-title').value;
  const date = document.getElementById('ev-date').value;
  const time = document.getElementById('ev-time').value;
  const note = document.getElementById('ev-note').value;
  if (await saveEvent(title, date, time, note)) {
    eventModal.classList.remove('open');
    toast(editEventId ? 'Evento actualizado' : 'Evento guardado');
    resetEventModal();
  }
};
