// Tests de integración: datos por espacio, permisos y agenda con zonas horarias
const assert = require('node:assert/strict');
const { setup, teardown, clearDB, run, summary } = require('./helpers');

async function registerAndLogin(req, name, email) {
  await req.post('/api/auth/register').send({ name, email, password: 'secret123' });
  const res = await req.post('/api/auth/login').send({ email, password: 'secret123' });
  return { token: res.body.token, user: res.body.user };
}

async function main() {
  const req = await setup();

  const { token: tokenA, user: userA } = await registerAndLogin(req, 'Ana', 'ana@test.com');
  const { token: tokenB } = await registerAndLogin(req, 'Bob', 'bob@test.com');

  const spaceIdA = userA.spaces[0].id; // espacio Personal de Ana

  // ── Control de acceso ─────────────────────────────────────
  await run('miembro puede leer su espacio', async () => {
    const res = await req.get(`/api/data/${spaceIdA}`).set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.compra));
  });

  await run('usuario ajeno no puede leer espacio de otro (403)', async () => {
    const res = await req.get(`/api/data/${spaceIdA}`).set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 403);
  });

  await run('sin token devuelve 401', async () => {
    const res = await req.get(`/api/data/${spaceIdA}`);
    assert.equal(res.status, 401);
  });

  // ── Compra ────────────────────────────────────────────────
  let itemId = null;
  await run('añadir producto a la compra', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/compra`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Leche' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'leche'); // normalizado a minúsculas
    itemId = res.body.id;
  });

  await run('producto sin nombre devuelve 400', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/compra`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: '' });
    assert.equal(res.status, 400);
  });

  await run('marcar producto como comprado', async () => {
    const res = await req.patch(`/api/data/${spaceIdA}/compra/${itemId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ done: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.done, true);
  });

  await run('usuario ajeno no puede modificar compra de otro (403)', async () => {
    const res = await req.patch(`/api/data/${spaceIdA}/compra/${itemId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ done: false });
    assert.equal(res.status, 403);
  });

  await run('eliminar producto', async () => {
    const res = await req.delete(`/api/data/${spaceIdA}/compra/${itemId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
  });

  // ── Tareas ────────────────────────────────────────────────
  let tareaId = null;
  await run('añadir tarea', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/tareas`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Llamar al banco' });
    assert.equal(res.status, 200);
    tareaId = res.body.id;
  });

  await run('eliminar tarea', async () => {
    const res = await req.delete(`/api/data/${spaceIdA}/tareas/${tareaId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
  });

  // ── Agenda ────────────────────────────────────────────────
  let eventId = null;
  await run('crear evento con zona horaria', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/agenda`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Dentista', date: '2026-06-15', time: '10:00', note: 'Revisión', timeZone: 'Europe/Madrid' });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Dentista');
    assert.equal(res.body.date, '2026-06-15');
    eventId = res.body.id;
  });

  await run('evento sin título devuelve 400', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/agenda`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2026-06-15', time: '10:00' });
    assert.equal(res.status, 400);
  });

  await run('evento con fecha inválida devuelve 400', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/agenda`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'X', date: '15/06/2026', time: '10:00' });
    assert.equal(res.status, 400);
  });

  await run('evento con hora inválida devuelve 400', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/agenda`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'X', date: '2026-06-15', time: '9:00' }); // debe ser HH:MM
    assert.equal(res.status, 400);
  });

  await run('editar evento actualiza campos', async () => {
    const res = await req.put(`/api/data/${spaceIdA}/agenda/${eventId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Dentista revisión', date: '2026-06-16', time: '11:00', note: 'Actualizado' });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Dentista revisión');
    assert.equal(res.body.date, '2026-06-16');
  });

  await run('usuario ajeno no puede editar evento de otro (403)', async () => {
    const res = await req.put(`/api/data/${spaceIdA}/agenda/${eventId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hack', date: '2026-06-16', time: '11:00' });
    assert.equal(res.status, 403);
  });

  await run('editar evento inexistente devuelve 404', async () => {
    const res = await req.put(`/api/data/${spaceIdA}/agenda/id-falso-123`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'X', date: '2026-06-16', time: '10:00' });
    assert.equal(res.status, 404);
  });

  await run('eliminar evento', async () => {
    const res = await req.delete(`/api/data/${spaceIdA}/agenda/${eventId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
  });

  // ── Notas ─────────────────────────────────────────────────
  let notaId = null;
  await run('crear nota', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/notas`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Ideas', body: 'Contenido de prueba' });
    assert.equal(res.status, 200);
    notaId = res.body.id;
  });

  await run('nota vacía devuelve 400', async () => {
    const res = await req.post(`/api/data/${spaceIdA}/notas`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: '', body: '' });
    assert.equal(res.status, 400);
  });

  await run('editar nota', async () => {
    const res = await req.put(`/api/data/${spaceIdA}/notas/${notaId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Ideas actualizadas', body: 'Nuevo contenido' });
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Ideas actualizadas');
  });

  await run('eliminar nota', async () => {
    const res = await req.delete(`/api/data/${spaceIdA}/notas/${notaId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
  });

  // ── Espacio compartido ────────────────────────────────────
  await run('miembro invitado puede leer y escribir en el espacio', async () => {
    // Ana crea espacio familiar
    const spaceRes = await req.post('/api/auth/space')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Casa', type: 'family' });
    const sharedSpaceId = spaceRes.body.spaceId;
    const code = spaceRes.body.inviteCode;

    // Bob se une
    await req.post('/api/auth/space/join')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code });

    // Bob puede escribir en el espacio compartido
    const res = await req.post(`/api/data/${sharedSpaceId}/compra`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Pan' });
    assert.equal(res.status, 200);
  });

  summary('data.test');
  await teardown();
}

main().catch(err => { console.error(err); process.exit(1); });
