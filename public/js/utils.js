// Utilidades globales: escape HTML, toast (con undo), wrapper fetch
const API_BASE = '';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toast(msg, dur = 2400) {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-undo-btn').style.display = 'none';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), dur);
}

function toastWithUndo(msg, onUndo, dur = 4000) {
  const el = document.getElementById('toast');
  const undoBtn = document.getElementById('toast-undo-btn');
  document.getElementById('toast-msg').textContent = msg;
  undoBtn.style.display = 'inline-block';
  undoBtn.onclick = () => {
    el.classList.remove('show');
    undoBtn.style.display = 'none';
    clearTimeout(el._timer);
    if (onUndo) onUndo();
  };
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove('show');
    undoBtn.style.display = 'none';
    undoBtn.onclick = null;
  }, dur);
}

async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API_BASE + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}
