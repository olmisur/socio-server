// Control de gastos: listado, resumen semanal y borrado con undo

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // lunes
  d.setHours(0, 0, 0, 0);
  return d;
}

function renderGastos() {
  const el = document.getElementById('gastos-list');
  const list = spaceData.gastos || [];
  const weekStart = getWeekStart();
  const weekTotal = list.filter(g => new Date(g.ts) >= weekStart).reduce((s, g) => s + g.amount, 0);

  document.getElementById('gastos-week-total').textContent = weekTotal.toFixed(2) + ' €';

  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>Sin gastos registrados</p></div>';
    return;
  }
  el.innerHTML = list.map(g => `
    <div class="list-item">
      <div class="item-body">
        <div class="item-name">${esc(g.description)} <span style="color:var(--accent2);font-weight:500">${Number(g.amount).toFixed(2)} €</span></div>
        ${g.addedBy && g.addedBy !== currentUser?.name ? `<div class="item-who">por ${esc(g.addedBy)}</div>` : ''}
      </div>
      <div class="item-who" style="margin-left:auto;padding-right:6px">${new Date(g.ts).toLocaleDateString('es-ES', { day:'numeric', month:'short' })}</div>
      <button class="item-del" onclick="deleteGastoWithUndo('${g.id}','${esc(g.description)}',${g.amount})">✕</button>
    </div>`).join('');
}

function deleteGastoWithUndo(id, desc, amount) {
  const prev = spaceData.gastos.find(g => g.id === id);
  spaceData.gastos = spaceData.gastos.filter(g => g.id !== id);
  renderGastos();

  if (undoQueue[id]) clearTimeout(undoQueue[id].timer);

  toastWithUndo(`"${desc}" (${Number(amount).toFixed(2)} €) eliminado`, () => {
    if (prev) spaceData.gastos = [prev, ...spaceData.gastos];
    renderGastos();
    delete undoQueue[id];
  });

  undoQueue[id] = {
    timer: setTimeout(async () => {
      delete undoQueue[id];
      try { await api(`/api/data/${currentSpaceId}/gastos/${id}`, 'DELETE'); await loadSpaceData(); }
      catch { toast('Error al eliminar'); }
    }, 4000)
  };
}

document.getElementById('gastos-add-btn').onclick = async () => {
  const desc = document.getElementById('gastos-desc').value.trim();
  const amount = parseFloat(document.getElementById('gastos-amount').value);
  if (!desc) { toast('Escribe una descripción'); return; }
  if (!isFinite(amount) || amount <= 0) { toast('Importe inválido'); return; }
  try {
    await api(`/api/data/${currentSpaceId}/gastos`, 'POST', { description: desc, amount });
    await loadSpaceData();
    renderGastos();
    document.getElementById('gastos-desc').value = '';
    document.getElementById('gastos-amount').value = '';
    toast('Gasto apuntado 💰');
  } catch (e) { toast(e.message); }
};
document.getElementById('gastos-amount').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('gastos-add-btn').click(); });
