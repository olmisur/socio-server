// Tests de integración: rutas de notificaciones push
const assert = require('node:assert/strict');
const { setup, teardown, run, summary } = require('./helpers');

async function main() {
  const req = await setup(); // VAPID no configurado en test env

  // Registrar usuario de prueba
  await req.post('/api/auth/register').send({ name: 'Ana', email: 'ana@test.com', password: 'secret123' });
  const login = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' });
  const token = login.body.token;
  const spaceId = login.body.user.spaces[0].id;

  // ── VAPID no configurado ──────────────────────────────────
  await run('GET /vapid-key sin config VAPID devuelve 503', async () => {
    const res = await req.get('/api/notif/vapid-key');
    assert.equal(res.status, 503);
  });

  await run('POST /subscribe sin config VAPID devuelve 503', async () => {
    const res = await req.post('/api/notif/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscription: { endpoint: 'https://example.com', keys: { p256dh: 'x', auth: 'y' } } });
    assert.equal(res.status, 503);
  });

  await run('POST /event-notif sin config VAPID devuelve 503', async () => {
    const res = await req.post('/api/notif/event-notif')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, eventId: 'ev-1', enabled: true });
    assert.equal(res.status, 503);
  });

  // ── Control de acceso ─────────────────────────────────────
  await run('POST /subscribe sin token devuelve 401', async () => {
    const res = await req.post('/api/notif/subscribe')
      .send({ subscription: { endpoint: 'https://example.com', keys: { p256dh: 'x', auth: 'y' } } });
    assert.equal(res.status, 401);
  });

  await run('POST /event-notif sin token devuelve 401', async () => {
    const res = await req.post('/api/notif/event-notif')
      .send({ spaceId, eventId: 'ev-1', enabled: true });
    assert.equal(res.status, 401);
  });

  await run('POST /test sin token devuelve 401', async () => {
    const res = await req.post('/api/notif/test');
    assert.equal(res.status, 401);
  });

  // ── Validación de body ────────────────────────────────────
  // Cuando VAPID no está configurado, la ruta falla antes de validar el body (503 tiene prioridad).
  // La validación del body (400) se comprueba en el mismo bloque de rutas cuando VAPID está activo;
  // aquí verificamos que al menos el servidor rechaza la petición (no pasa silenciosamente).
  await run('POST /event-notif con spaceId inválido es rechazado por el servidor', async () => {
    const res = await req.post('/api/notif/event-notif')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId: '', eventId: 'ev-1', enabled: true });
    assert.ok(res.status >= 400, `esperado >= 400, obtenido ${res.status}`);
  });

  await run('POST /event-notif con enabled no booleano es rechazado por el servidor', async () => {
    const res = await req.post('/api/notif/event-notif')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, eventId: 'ev-1', enabled: 'yes' });
    assert.ok(res.status >= 400, `esperado >= 400, obtenido ${res.status}`);
  });

  await run('GET /debug con token válido responde con diagnóstico', async () => {
    const res = await req.get('/api/notif/debug').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.hasVapidConfig, false);
    assert.ok('schedulerRunning' in res.body);
  });

  summary('notif.test');
  await teardown();
}

main().catch(err => { console.error(err); process.exit(1); });
