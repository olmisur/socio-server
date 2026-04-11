const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Space = require('../models/Space');
const authMiddleware = require('../middleware/auth');
const {
  ensureObject,
  enumValue,
  inviteCode,
  normalizedEmail,
  requiredString,
  safeError
} = require('../utils/requestValidation');

const router = express.Router();

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function genCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join(''); }
function makeToken(id) { return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '90d' }); }

router.post('/register', async (req, res) => {
  try {
    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre invalido', { min: 2, max: 80 });
    const email = normalizedEmail(body.email);
    const password = requiredString(body.password, 'La contrasena debe tener al menos 6 caracteres', { min: 6, max: 200, transform: input => input });

    if (await User.findOne({ email })) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const personalSpaceId = genId();
    const personalSpace = await Space.create({
      id: personalSpaceId,
      name: 'Personal',
      type: 'personal',
      members: [{ userId: 'pending', name, email, role: 'owner' }]
    });

    const user = await User.create({
      name,
      email,
      password,
      spaces: [{ id: personalSpaceId, name: 'Personal', type: 'personal', role: 'owner' }]
    });

    personalSpace.members[0].userId = user._id.toString();
    await personalSpace.save();

    const token = makeToken(user._id);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, spaces: user.spaces } });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    console.error(e);
    return res.status(500).json({ error: 'Error al registrar' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const body = ensureObject(req.body);
    const email = normalizedEmail(body.email);
    const password = requiredString(body.password, 'Contrasena invalida', { min: 1, max: 200, transform: input => input });
    const user = await User.findOne({ email });

    if (!user || !await user.comparePassword(password)) {
      return res.status(401).json({ error: 'Email o contrasena incorrectos' });
    }

    const token = makeToken(user._id);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, spaces: user.spaces } });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  return res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, spaces: req.user.spaces } });
});

router.post('/space', authMiddleware, async (req, res) => {
  try {
    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre de espacio invalido', { min: 2, max: 80 });
    const type = enumValue(body.type, ['family', 'business'], 'Tipo invalido');

    const spaceId = genId();
    const joinCode = genCode();

    await Space.create({
      id: spaceId,
      name,
      type,
      inviteCode: joinCode,
      members: [{ userId: req.user._id.toString(), name: req.user.name, email: req.user.email, role: 'owner' }]
    });

    req.user.spaces.push({ id: spaceId, name, type, role: 'owner' });
    await req.user.save();

    return res.json({ spaceId, inviteCode: joinCode, spaces: req.user.spaces });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error al crear espacio' });
  }
});

router.post('/space/join', authMiddleware, async (req, res) => {
  try {
    const body = ensureObject(req.body);
    const code = inviteCode(body.code);
    const space = await Space.findOne({ inviteCode: code });

    if (!space) return res.status(404).json({ error: 'Codigo no encontrado' });

    const alreadyMember = space.members.find(member => member.userId === req.user._id.toString());
    if (alreadyMember) return res.status(400).json({ error: 'Ya eres miembro de este espacio' });

    space.members.push({ userId: req.user._id.toString(), name: req.user.name, email: req.user.email, role: 'member' });
    await space.save();

    req.user.spaces.push({ id: space.id, name: space.name, type: space.type, role: 'member' });
    await req.user.save();

    return res.json({ spaceId: space.id, spaceName: space.name, spaces: req.user.spaces });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error al unirse' });
  }
});

module.exports = router;
