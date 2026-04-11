// Núcleo de la app: arranque, espacios, tabs, FAB y polling

function getSpaceName() {
  const s = currentUser?.spaces.find(x => x.id === currentSpaceId);
  return s ? s.name : '';
}

function getSpaceType() {
  const s = currentUser?.spaces.find(x => x.id === currentSpaceId);
  return s ? s.type : 'personal';
}

function renderSpaces() {
  const bar = document.getElementById('space-bar');
  const addBtn = document.getElementById('add-space-btn');
  bar.innerHTML = '';
  bar.appendChild(addBtn);
  const icons = { personal: '🏠', family: '👨‍👩‍👧', business: '💼' };
  currentUser.spaces.forEach(sp => {
    const btn = document.createElement('button');
    btn.className = `space-pill ${sp.type}${sp.id === currentSpaceId ? ' active' : ''}`;
    btn.textContent = `${icons[sp.type] || ''} ${sp.name}`;
    btn.onclick = () => switchSpace(sp.id);
    bar.insertBefore(btn, addBtn);
  });
  document.getElementById('space-label').textContent = getSpaceName();
  ['compra', 'tareas', 'agenda', 'notas'].forEach(t => {
    const tag = document.getElementById(`${t}-space-tag`);
    if (tag) { tag.textContent = getSpaceName(); tag.className = `space-tag ${getSpaceType()}`; }
  });
}

async function switchSpace(id) {
  currentSpaceId = id;
  clearInterval(pollTimer);
  chatHistory = [];
  renderSpaces();
  await loadSpaceData();
  renderAll();
  pollTimer = setInterval(async () => { await loadSpaceData(); if (currentTab !== 'chat') renderAll(); }, 5000);
}

async function loadSpaceData() {
  try { const d = await api(`/api/data/${currentSpaceId}`); spaceData = { ...d }; } catch (e) {}
}

function renderAll() {
  renderList('compra');
  renderList('tareas');
  renderAgenda();
  renderNotas();
}

async function startApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').style.display = 'flex';
  renderSpaces();
  const first = currentUser.spaces[0];
  if (first) await switchSpace(first.id);
  document.getElementById('loading').classList.add('hidden');
  addMsg(`¡Buenas, ${currentUser.name.split(' ')[0]}! 🤝 Estás en <strong>${getSpaceName()}</strong>.<br>Pulsa <strong>🎙️ libre</strong> para el modo manos libres — escucha continua sin tocar nada.`, 'bot', false, true);
  addSuggs(['Apunta mantequilla y leche', 'Cita médica mañana 10h', '¿Qué tengo pendiente?', 'Añade tarea: llamar al banco']);
  await initPush();
}

// Espacios: modal de nuevo espacio e invitación
let selType = 'family';

document.getElementById('add-space-btn').onclick = () => document.getElementById('space-modal').classList.add('open');
document.getElementById('space-modal-cancel').onclick = () => document.getElementById('space-modal').classList.remove('open');

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selType = btn.dataset.type;
  };
});

document.getElementById('space-modal-save').onclick = async () => {
  const code = document.getElementById('space-join-code').value.trim().toUpperCase();
  const name = document.getElementById('space-name').value.trim();
  try {
    let data;
    if (code) {
      data = await api('/api/auth/space/join', 'POST', { code });
    } else {
      if (!name) { toast('Pon un nombre'); return; }
      data = await api('/api/auth/space', 'POST', { name, type: selType });
    }
    currentUser.spaces = data.spaces;
    document.getElementById('space-modal').classList.remove('open');
    document.getElementById('space-name').value = '';
    document.getElementById('space-join-code').value = '';
    renderSpaces();
    if (data.spaceId) await switchSpace(data.spaceId);
    toast(code ? '¡Unido al espacio! 🎉' : 'Espacio creado 🎉');
  } catch (e) { toast(e.message); }
};

document.getElementById('invite-btn').onclick = () => {
  const sp = currentUser.spaces.find(s => s.id === currentSpaceId);
  document.getElementById('invite-space-name').textContent = sp?.name || '';
  document.getElementById('invite-code').textContent = spaceData.inviteCode || 'Sin código';
  document.getElementById('invite-panel').classList.add('open');
};
document.getElementById('invite-code').onclick = () =>
  navigator.clipboard?.writeText(spaceData.inviteCode).then(() => toast('Código copiado ✓'));
document.getElementById('invite-close').onclick = () =>
  document.getElementById('invite-panel').classList.remove('open');

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(currentTab + '-view').classList.add('active');
    document.getElementById('fab').style.display = (currentTab === 'agenda' || currentTab === 'notas') ? 'flex' : 'none';
    if (currentTab === 'compra') renderList('compra');
    if (currentTab === 'tareas') renderList('tareas');
    if (currentTab === 'agenda') renderAgenda();
    if (currentTab === 'notas') renderNotas();
  });
});

// FAB
document.getElementById('fab').onclick = () => {
  if (currentTab === 'agenda') openEventModal(null);
  else if (currentTab === 'notas') openNote(null);
};

// Boot
async function boot() {
  if (token) {
    try {
      const data = await api('/api/auth/me');
      currentUser = data.user;
      await startApp();
    } catch (e) {
      localStorage.removeItem('socio_token');
      token = null;
      document.getElementById('loading').classList.add('hidden');
    }
  } else {
    document.getElementById('loading').classList.add('hidden');
  }
}

boot();
