const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Space = require('../models/Space');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function genCode() { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
function makeToken(id) { return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '90d' }); }

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name || !normalizedEmail || !password) return res.status(400).json({ error: 'Faltan campos' });
    if (await User.findOne({ email: normalizedEmail })) return res.status(400).json({ error: 'Email ya registrado' });

    // Create personal space
    const personalSpaceId = genId();
    const personalSpace = await Space.create({
      id: personalSpaceId,
      name: 'Personal',
      type: 'personal',
      members: [{ userId: 'pending', name, email: normalizedEmail, role: 'owner' }]
    });

    const user = await User.create({
      name, email: normalizedEmail, password,
      spaces: [{ id: personalSpaceId, name: 'Personal', type: 'personal', role: 'owner' }]
    });

    // Update space with real userId
    personalSpace.members[0].userId = user._id.toString();
    await personalSpace.save();

    const token = makeToken(user._id);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, spaces: user.spaces } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !await user.comparePassword(password)) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    const token = makeToken(user._id);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, spaces: user.spaces } });
  } catch (e) {
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, spaces: req.user.spaces } });
});

// Create space (family or business)
router.post('/space', authMiddleware, async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!['family','business'].includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

    const spaceId = genId();
    const inviteCode = genCode();

    await Space.create({
      id: spaceId, name, type,
      inviteCode,
      members: [{ userId: req.user._id.toString(), name: req.user.name, email: req.user.email, role: 'owner' }]
    });

    req.user.spaces.push({ id: spaceId, name, type, role: 'owner' });
    await req.user.save();

    res.json({ spaceId, inviteCode, spaces: req.user.spaces });
  } catch (e) {
    res.status(500).json({ error: 'Error al crear espacio' });
  }
});

// Join space by invite code
router.post('/space/join', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    const space = await Space.findOne({ inviteCode: code.toUpperCase() });
    if (!space) return res.status(404).json({ error: 'Código no encontrado' });

    const alreadyMember = space.members.find(m => m.userId === req.user._id.toString());
    if (alreadyMember) return res.status(400).json({ error: 'Ya eres miembro de este espacio' });

    space.members.push({ userId: req.user._id.toString(), name: req.user.name, email: req.user.email, role: 'member' });
    await space.save();

    req.user.spaces.push({ id: space.id, name: space.name, type: space.type, role: 'member' });
    await req.user.save();

    res.json({ spaceId: space.id, spaceName: space.name, spaces: req.user.spaces });
  } catch (e) {
    res.status(500).json({ error: 'Error al unirse' });
  }
});

module.exports = router;
