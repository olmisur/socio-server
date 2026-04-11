// Tests de integración: autenticación y gestión de espacios
const assert = require('node:assert/strict');
const { setup, teardown, clearDB, run, summary } = require('./helpers');

async function main() {
  const req = await setup();

  // ── Registro ──────────────────────────────────────────────
  await run('registro con datos válidos devuelve token y espacio Personal', async () => {
    const res = await req.post('/api/auth/register').send({ name: 'Ana', email: 'ana@test.com', password: 'secret123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.name, 'Ana');
    assert.equal(res.body.user.spaces[0].name, 'Personal');
  });

  await run('registro con email duplicado devuelve 400', async () => {
    const res = await req.post('/api/auth/register').send({ name: 'Ana2', email: 'ana@test.com', password: 'secret123' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /registrado/i);
  });

  await run('registro sin nombre devuelve 400', async () => {
    const res = await req.post('/api/auth/register').send({ email: 'x@test.com', password: 'secret123' });
    assert.equal(res.status, 400);
  });

  await run('registro con contraseña corta devuelve 400', async () => {
    const res = await req.post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.com', password: '12' });
    assert.equal(res.status, 400);
  });

  await run('registro normaliza email a minúsculas', async () => {
    const res = await req.post('/api/auth/register').send({ name: 'Carlos', email: 'CARLOS@TEST.COM', password: 'secret123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'carlos@test.com');
  });

  // ── Login ─────────────────────────────────────────────────
  await run('login correcto devuelve token', async () => {
    const res = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  await run('login con contraseña incorrecta devuelve 401', async () => {
    const res = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'wrongpass' });
    assert.equal(res.status, 401);
  });

  await run('login con email inexistente devuelve 401', async () => {
    const res = await req.post('/api/auth/login').send({ email: 'noexiste@test.com', password: 'secret123' });
    assert.equal(res.status, 401);
  });

  await run('login normaliza email en mayúsculas', async () => {
    const res = await req.post('/api/auth/login').send({ email: 'ANA@TEST.COM', password: 'secret123' });
    assert.equal(res.status, 200);
  });

  // ── /me ───────────────────────────────────────────────────
  await run('GET /me con token válido devuelve el usuario', async () => {
    const login = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' });
    const res = await req.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'ana@test.com');
  });

  await run('GET /me sin token devuelve 401', async () => {
    const res = await req.get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  // ── Espacios ──────────────────────────────────────────────
  let inviteCode = null;
  await run('crear espacio familiar devuelve inviteCode', async () => {
    const login = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' });
    const res = await req.post('/api/auth/space')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Casa', type: 'family' });
    assert.equal(res.status, 200);
    assert.ok(res.body.inviteCode);
    assert.ok(res.body.spaceId);
    inviteCode = res.body.inviteCode;
  });

  await run('unirse a espacio con código válido', async () => {
    await req.post('/api/auth/register').send({ name: 'Luis', email: 'luis@test.com', password: 'secret123' });
    const login = await req.post('/api/auth/login').send({ email: 'luis@test.com', password: 'secret123' });
    const res = await req.post('/api/auth/space/join')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ code: inviteCode });
    assert.equal(res.status, 200);
    assert.ok(res.body.spaceId);
  });

  await run('unirse dos veces al mismo espacio devuelve 400', async () => {
    const login = await req.post('/api/auth/login').send({ email: 'luis@test.com', password: 'secret123' });
    const res = await req.post('/api/auth/space/join')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ code: inviteCode });
    assert.equal(res.status, 400);
  });

  await run('código de invitación inexistente devuelve 404', async () => {
    const login = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' });
    const res = await req.post('/api/auth/space/join')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ code: 'XXXXXX' });
    assert.equal(res.status, 404);
  });

  await run('tipo de espacio inválido devuelve 400', async () => {
    const login = await req.post('/api/auth/login').send({ email: 'ana@test.com', password: 'secret123' });
    const res = await req.post('/api/auth/space')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'X', type: 'invalid' });
    assert.equal(res.status, 400);
  });

  summary('auth.test');
  await teardown();
}

main().catch(err => { console.error(err); process.exit(1); });
