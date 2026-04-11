// Onboarding: guía de 3 pasos que aparece una vez en el primer acceso
const STEPS = [
  {
    icon: '🤝',
    title: '¡Bienvenido a Socio!',
    body: 'Tu asistente personal para la lista de la compra, tareas, agenda y mucho más. Habla con él en texto o con tu voz.',
    action: null
  },
  {
    icon: '👥',
    title: 'Espacios compartidos',
    body: 'Crea un espacio familiar o de trabajo y comparte el código de invitación con tu pareja o equipo para sincronizar todo en tiempo real.',
    action: null
  },
  {
    icon: '🔔',
    title: 'Notificaciones y voz',
    body: 'Activa las notificaciones para recibir recordatorios de eventos y el resumen matutino. Usa el botón 🎙️ libre para el modo manos libres.',
    action: { label: 'Activar notificaciones', fn: () => requestPushPermission() }
  }
];

let onbStep = 0;

function showOnboarding() {
  if (localStorage.getItem('socio_onboarded')) return;
  onbStep = 0;
  renderOnbStep();
  document.getElementById('onboarding-overlay').classList.add('open');
}

function renderOnbStep() {
  const s = STEPS[onbStep];
  document.getElementById('onb-icon').textContent = s.icon;
  document.getElementById('onb-title').textContent = s.title;
  document.getElementById('onb-body').textContent = s.body;

  const actionBtn = document.getElementById('onb-action-btn');
  if (s.action) {
    actionBtn.textContent = s.action.label;
    actionBtn.style.display = 'block';
    actionBtn.onclick = () => s.action.fn();
  } else {
    actionBtn.style.display = 'none';
  }

  document.getElementById('onb-next-btn').textContent = onbStep < STEPS.length - 1 ? 'Siguiente →' : '¡Empezar!';
  document.getElementById('onb-dots').innerHTML = STEPS.map((_, i) =>
    `<span class="onb-dot${i === onbStep ? ' active' : ''}"></span>`
  ).join('');
}

function onbNext() {
  if (onbStep < STEPS.length - 1) {
    onbStep++;
    renderOnbStep();
  } else {
    localStorage.setItem('socio_onboarded', '1');
    document.getElementById('onboarding-overlay').classList.remove('open');
  }
}

document.getElementById('onb-next-btn').onclick = onbNext;
document.getElementById('onb-skip-btn').onclick = () => {
  localStorage.setItem('socio_onboarded', '1');
  document.getElementById('onboarding-overlay').classList.remove('open');
};
