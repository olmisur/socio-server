// Chat IA y escáner de ticket

function getCtx() {
  const c = spaceData.compra || [], t = spaceData.tareas || [], a = spaceData.agenda || [], g = spaceData.gastos || [];
  const gTotal = g.reduce((s, x) => s + x.amount, 0);
  return `\n[${getSpaceName()}] Compra: ${c.length ? c.map(x => (x.done ? '[✓] ' : '') + x.name).join(', ') : 'vacía'} | Tareas: ${t.length ? t.map(x => (x.done ? '[✓] ' : '') + x.name).join(', ') : 'vacías'} | Agenda: ${a.length ? a.slice(0, 5).map(e => `${e.date} ${e.time || ''} ${e.title}`).join('; ') : 'sin eventos'} | Gastos totales: ${gTotal.toFixed(2)}€`;
}

const SYS = `Eres "Socio", asistente personal en español de España. Claro, cordial y eficiente.
SOLO responde con JSON válido sin texto fuera. Formato: {"action":"...","items":[],"event":{},"note":{},"gasto":{},"recurrente":{},"message":"..."}
ACCIONES: add_compra(items[]), add_tarea(items[]), add_event(event:{title,date:YYYY-MM-DD,time:HH:MM,note}), add_nota(note:{title,body}), add_gasto(gasto:{amount,description}), add_recurrente(recurrente:{name,type:'tareas'|'compra',pattern}), remove_compra(items[]), remove_tarea(items[]), done_compra(items[]), done_tarea(items[]), none.
PATRONES recurrente: 'daily'=cada día, 'weekly:1'=lunes, 'weekly:2'=martes, 'weekly:3'=miércoles, 'weekly:4'=jueves, 'weekly:5'=viernes, 'weekly:6'=sábado, 'weekly:0'=domingo, 'monthly:N'=día N de cada mes.
message: máx 2 frases breves, claras y cordiales. Sin coletillas coloquiales.
Hoy: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. ISO: ${new Date().toISOString().slice(0, 10)}.`;

function addMsg(html, role, thinking = false, isHtml = false) {
  const msgs = document.getElementById('messages');
  const wrap = document.createElement('div');
  wrap.className = `msg-wrap ${role}`;
  const bubble = document.createElement('div');
  bubble.className = `msg ${role}${thinking ? ' thinking' : ''}`;
  if (isHtml) bubble.innerHTML = html; else bubble.textContent = html;
  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  wrap.appendChild(bubble);
  if (!thinking) wrap.appendChild(time);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
  return bubble;
}

function addSuggs(suggs) {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'suggestions';
  suggs.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'sugg';
    btn.textContent = s;
    btn.onclick = () => { document.getElementById('chat-input').value = s; sendChat(); };
    div.appendChild(btn);
  });
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap bot';
  wrap.appendChild(div);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').disabled = true;
  hfPaused = true;
  addMsg(text, 'user');
  chatHistory.push({ role: 'user', content: text + getCtx() });
  const thinking = addMsg('...', 'bot', true);
  try {
    const data = await api('/api/ai/chat', 'POST', { system: SYS, messages: chatHistory.slice(-12) });
    const raw = data.content?.[0]?.text || '{"action":"none","message":"No te he entendido."}';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { parsed = { action: 'none', message: raw }; }
    await doAction(parsed);
    thinking.parentElement.remove();
    addMsg(parsed.message || '¿Qué me decías?', 'bot');
    chatHistory.push({ role: 'assistant', content: raw });
    if (chatHistory.length <= 2) addSuggs(['Apunta mantequilla', 'Añade leche y pan', 'Cita médica mañana', '¿Qué tengo pendiente?']);
    speak(parsed.message || '', () => { hfPaused = false; if (handsFreeOn) scheduleHFRestart(600); });
  } catch (e) {
    thinking.parentElement.remove();
    addMsg('Uy, algo ha fallado. Comprueba la conexión.', 'bot');
    hfPaused = false;
    if (handsFreeOn) scheduleHFRestart();
  }
  document.getElementById('send-btn').disabled = false;
}

async function doAction(p) {
  const { action, items = [], event = {}, note = {} } = p;
  if (action === 'add_compra') { for (const n of items) await addItem('compra', n); }
  else if (action === 'add_tarea') { for (const n of items) await addItem('tareas', n); }
  else if (action === 'remove_compra') { for (const n of items) { const it = spaceData.compra.find(x => x.name.includes(n.toLowerCase())); if (it) await delItem('compra', it.id); } }
  else if (action === 'remove_tarea') { for (const n of items) { const it = spaceData.tareas.find(x => x.name.includes(n.toLowerCase())); if (it) await delItem('tareas', it.id); } }
  else if (action === 'done_compra') { for (const n of items) { const it = spaceData.compra.find(x => x.name.includes(n.toLowerCase())); if (it) await toggleItem('compra', it.id, true); } }
  else if (action === 'done_tarea') { for (const n of items) { const it = spaceData.tareas.find(x => x.name.includes(n.toLowerCase())); if (it) await toggleItem('tareas', it.id, true); } }
  else if (action === 'add_event' && event.title) await addEvent(event.title, event.date || new Date().toISOString().slice(0, 10), event.time || '', event.note || '');
  else if (action === 'add_nota' && (note.title || note.body)) {
    await api(`/api/data/${currentSpaceId}/notas`, 'POST', { title: note.title || '', body: note.body || '' });
    await loadSpaceData();
    if (currentTab === 'notas') renderNotas();
  }
  else if (action === 'add_gasto' && p.gasto?.amount && p.gasto?.description) {
    await api(`/api/data/${currentSpaceId}/gastos`, 'POST', { amount: p.gasto.amount, description: p.gasto.description });
    await loadSpaceData();
    if (currentTab === 'gastos') renderGastos();
  }
  else if (action === 'add_recurrente' && p.recurrente?.name && p.recurrente?.pattern) {
    await api(`/api/data/${currentSpaceId}/recurrentes`, 'POST', { name: p.recurrente.name, type: p.recurrente.type || 'tareas', pattern: p.recurrente.pattern });
    await loadSpaceData();
    if (currentTab === 'tareas') renderList('tareas');
  }
}

const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 110) + 'px';
  document.getElementById('send-btn').disabled = !chatInput.value.trim();
});
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
document.getElementById('send-btn').onclick = sendChat;

// Ticket
document.getElementById('ticket-btn').onclick = () => document.getElementById('ticket-panel').classList.add('open');
document.getElementById('ticket-back').onclick = () => document.getElementById('ticket-panel').classList.remove('open');
document.getElementById('ticket-camera-btn').onclick = () => document.getElementById('file-input').click();

document.getElementById('file-input').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    ticketData = ev.target.result.split(',')[1];
    const prev = document.getElementById('ticket-preview');
    prev.src = ev.target.result;
    prev.style.display = 'block';
    document.getElementById('ticket-placeholder').style.display = 'none';
    document.getElementById('ticket-analyze-btn').style.display = 'block';
    document.getElementById('ticket-result').style.display = 'none';
  };
  reader.readAsDataURL(file);
};

document.getElementById('ticket-analyze-btn').onclick = async () => {
  if (!ticketData) return;
  const btn = document.getElementById('ticket-analyze-btn');
  btn.innerHTML = '<span class="spinner"></span> Analizando...';
  btn.disabled = true;
  const res = document.getElementById('ticket-result');
  res.style.display = 'block';
  res.textContent = 'Leyendo el ticket...';
  try {
    const data = await api('/api/ai/ticket', 'POST', { imageData: ticketData });
    const raw = data.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { parsed = { productos: [], resumen: 'No pude leer el ticket' }; }
    if (parsed.productos?.length) {
      res.innerHTML = `<strong style="color:var(--text)">Detectado:</strong><br>${parsed.productos.map(p => `• ${p}`).join('<br>')}`;
      for (const p of parsed.productos) await addItem('compra', p);
      toast(`${parsed.productos.length} productos añadidos 🛒`);
      speak(`He detectado ${parsed.productos.length} productos y los he apuntado`);
    } else {
      res.textContent = parsed.resumen || 'No detecté productos';
    }
  } catch (e) { res.textContent = 'Error al analizar.'; }
  btn.innerHTML = '✨ Analizar de nuevo';
  btn.disabled = false;
};
