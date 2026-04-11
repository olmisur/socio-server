// Autenticación: login, registro y logout
let isRegister = false;

document.getElementById('auth-toggle').onclick = function () {
  isRegister = !isRegister;
  document.getElementById('register-name-wrap').style.display = isRegister ? 'block' : 'none';
  document.getElementById('auth-submit').textContent = isRegister ? 'Crear cuenta' : 'Entrar';
  document.getElementById('auth-switch').innerHTML = isRegister
    ? '¿Ya tienes cuenta? <span id="auth-toggle">Inicia sesión</span>'
    : '¿No tienes cuenta? <span id="auth-toggle">Regístrate</span>';
  document.getElementById('auth-toggle').onclick = this;
  document.getElementById('auth-error').textContent = '';
};

document.getElementById('auth-submit').onclick = async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const name = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Rellena todos los campos'; return; }
  document.getElementById('auth-submit').innerHTML = '<span class="spinner"></span>';
  try {
    let data;
    if (isRegister) {
      if (!name) { errEl.textContent = 'Pon tu nombre'; document.getElementById('auth-submit').textContent = 'Crear cuenta'; return; }
      data = await api('/api/auth/register', 'POST', { name, email, password: pass });
    } else {
      data = await api('/api/auth/login', 'POST', { email, password: pass });
    }
    token = data.token;
    localStorage.setItem('socio_token', token);
    currentUser = data.user;
    startApp();
  } catch (e) {
    errEl.textContent = e.message;
    document.getElementById('auth-submit').textContent = isRegister ? 'Crear cuenta' : 'Entrar';
  }
};

['auth-email', 'auth-pass', 'auth-name'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('auth-submit').click(); });
});

document.getElementById('logout-btn').onclick = () => {
  localStorage.removeItem('socio_token');
  token = null;
  currentUser = null;
  clearInterval(pollTimer);
  stopListen();
  handsFreeOn = false;
  updateHFBtn();
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').classList.remove('hidden');
};
