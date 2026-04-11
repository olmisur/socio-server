// TTS, reconocimiento de voz y modo manos libres

// TTS
function toggleTts() {
  ttsOn = !ttsOn;
  localStorage.setItem('socio_tts', ttsOn ? 'on' : 'off');
  const btn = document.getElementById('tts-btn');
  btn.textContent = ttsOn ? '🔊' : '🔇';
  btn.className = ttsOn ? '' : 'off';
  toast(ttsOn ? 'Voz activada 🔊' : 'Voz desactivada 🔇');
}

function speak(text, onEnd) {
  if (!text || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  if (!ttsOn) { if (onEnd) onEnd(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES';
  u.rate = 1.05;
  const v = speechSynthesis.getVoices().find(x => x.lang.startsWith('es') && !x.lang.includes('US'));
  if (v) u.voice = v;
  u.onend = () => { if (onEnd) onEnd(); };
  speechSynthesis.speak(u);
}

document.getElementById('tts-btn').textContent = ttsOn ? '🔊' : '🔇';
if (!ttsOn) document.getElementById('tts-btn').className = 'off';

// Reconocimiento de voz
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SR) {
  recognition = new SR();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isListening = true;
    document.getElementById('mic-btn').classList.add('listening');
    document.getElementById('mic-overlay').classList.add('show');
    document.getElementById('mic-interim').textContent = '';
  };

  recognition.onresult = e => {
    const interim = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('mic-interim').textContent = interim;
    if (e.results[e.results.length - 1].isFinal) {
      stopListen();
      if (interim.trim()) {
        document.getElementById('chat-input').value = interim.trim();
        document.getElementById('send-btn').disabled = false;
        sendChat();
      } else if (handsFreeOn) {
        scheduleHFRestart();
      }
    }
  };

  recognition.onerror = e => {
    stopListen();
    if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Error de micrófono: ' + e.error);
    if (handsFreeOn && e.error === 'no-speech') scheduleHFRestart();
  };

  recognition.onend = () => {
    isListening = false;
    document.getElementById('mic-btn').classList.remove('listening');
    document.getElementById('mic-overlay').classList.remove('show');
    if (handsFreeOn && !hfPaused) scheduleHFRestart();
  };
} else {
  document.getElementById('mic-btn').style.opacity = '0.3';
  document.getElementById('handsfree-btn').style.opacity = '0.3';
}

function startListen() {
  if (!recognition || isListening) return;
  try { recognition.start(); } catch (e) {}
}

function stopListen() {
  isListening = false;
  document.getElementById('mic-btn').classList.remove('listening');
  document.getElementById('mic-overlay').classList.remove('show');
  try { recognition.stop(); } catch (e) {}
}

function scheduleHFRestart(delay = 1000) {
  clearTimeout(hfRestartTimer);
  hfRestartTimer = setTimeout(() => { if (handsFreeOn && !hfPaused && !isListening) startListen(); }, delay);
}

function updateHFBtn() {
  const btn = document.getElementById('handsfree-btn');
  if (handsFreeOn) {
    btn.textContent = '🟢 libre';
    btn.classList.add('active');
    document.getElementById('mic-wave').classList.add('green');
    document.getElementById('mic-status').textContent = 'Manos libres activo';
  } else {
    btn.textContent = '🎙️ libre';
    btn.classList.remove('active');
    document.getElementById('mic-wave').classList.remove('green');
    document.getElementById('mic-status').textContent = 'Escuchando...';
  }
}

function toggleHandsFree() {
  handsFreeOn = !handsFreeOn;
  hfPaused = false;
  updateHFBtn();
  if (handsFreeOn) {
    toast('🟢 Manos libres activado');
    speak('Manos libres activado, te escucho.', () => scheduleHFRestart(300));
  } else {
    clearTimeout(hfRestartTimer);
    stopListen();
    toast('Manos libres desactivado');
  }
}

document.getElementById('mic-btn').onclick = () => { if (isListening) stopListen(); else startListen(); };
document.getElementById('mic-cancel').onclick = () => {
  if (handsFreeOn) {
    hfPaused = true;
    clearTimeout(hfRestartTimer);
    stopListen();
    toast('Escucha pausada. Pulsa 🟢 libre para reanudar.');
  } else {
    stopListen();
  }
};
