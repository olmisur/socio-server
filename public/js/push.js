// Notificaciones push: suscripción VAPID y toggle por evento

async function getVapidKey() {
  if (vapidKey) return vapidKey;
  const data = await api('/api/notif/vapid-key');
  vapidKey = data.publicKey;
  return vapidKey;
}

async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!token) return false;
  try {
    const key = await getVapidKey();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      if (Notification.permission !== 'granted') return false;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    }
    return await saveSub(sub);
  } catch (e) { console.log('ensurePushSubscription error:', e); return false; }
}

async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!token) return;
  try {
    await getVapidKey();
    if (Notification.permission === 'granted') await ensurePushSubscription();
  } catch (e) { console.log('initPush error:', e); }
}

async function requestPushPermission() {
  try {
    await getVapidKey();
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Permiso denegado. Actívalo en ajustes del navegador.'); return false; }
    const ok = await ensurePushSubscription();
    if (ok) { toast('Notificaciones activadas'); return true; }
    toast('Error guardando suscripción');
    return false;
  } catch (e) { console.log('pushPermission error:', e); toast('Error activando notificaciones: ' + e.message); return false; }
}

async function saveSub(sub) {
  try {
    const subJson = sub.toJSON ? sub.toJSON() : sub;
    await api('/api/notif/subscribe', 'POST', { subscription: subJson });
    return true;
  } catch (e) { console.log('saveSub error:', e); return false; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function toggleEventNotif(spaceId, eventId, btn) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Push no disponible');
    return;
  }
  const isActive = btn.dataset.active === 'true';
  if (!isActive) {
    const ok = Notification.permission === 'granted'
      ? await ensurePushSubscription()
      : await requestPushPermission();
    if (!ok) return;
  }
  try {
    await api('/api/notif/event-notif', 'POST', { spaceId, eventId, enabled: !isActive });
    btn.dataset.active = (!isActive).toString();
    btn.textContent = !isActive ? '🔔' : '🔕';
    btn.style.opacity = !isActive ? '1' : '0.4';
    toast(!isActive ? 'Aviso activado 30 min antes 🔔' : 'Aviso cancelado');
  } catch (e) { toast('Error'); }
}

// Helpers de depuración expuestos en window
window.socioDebugPush = (spaceId, eventId) => api(`/api/notif/debug?spaceId=${encodeURIComponent(spaceId)}&eventId=${encodeURIComponent(eventId)}`);
window.socioTestPush = () => api('/api/notif/test', 'POST');
window.socioRunNotifCheck = () => api('/api/notif/check-now', 'POST');
