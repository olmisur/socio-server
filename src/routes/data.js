const express = require('express');
const Space = require('../models/Space');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// Verify user has access to space
async function getSpace(spaceId, userId) {
  const space = await Space.findOne({ id: spaceId });
  if (!space) return null;
  const isMember = space.members.find(m => m.userId === userId.toString());
  return isMember ? space : null;
}

// GET all data for a space
router.get('/:spaceId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    res.json({
      compra: space.compra,
      tareas: space.tareas,
      agenda: space.agenda,
      notas: space.notas,
      members: space.members.map(m => ({ name: m.name, role: m.role })),
      inviteCode: space.inviteCode
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// ====== COMPRA ======
router.post('/:spaceId/compra', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const item = { id: genId(), name: name.trim().toLowerCase(), done: false, addedBy: req.user.name, ts: new Date() };
    space.compra.push(item);
    await space.save();
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.patch('/:spaceId/compra/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const item = space.compra.find(i => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    if (req.body.done !== undefined) item.done = req.body.done;
    await space.save();
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/:spaceId/compra/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    space.compra = space.compra.filter(i => i.id !== req.params.itemId);
    await space.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/:spaceId/compra', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    if (req.query.done === 'true') space.compra = space.compra.filter(i => !i.done);
    else space.compra = [];
    await space.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ====== TAREAS ======
router.post('/:spaceId/tareas', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const item = { id: genId(), name: req.body.name.trim(), done: false, addedBy: req.user.name, ts: new Date() };
    space.tareas.push(item);
    await space.save();
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.patch('/:spaceId/tareas/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const item = space.tareas.find(i => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    if (req.body.done !== undefined) item.done = req.body.done;
    if (req.body.name) item.name = req.body.name;
    await space.save();
    res.json(item);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/:spaceId/tareas/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    space.tareas = space.tareas.filter(i => i.id !== req.params.itemId);
    await space.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ====== AGENDA ======
router.post('/:spaceId/agenda', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const { title, date, time, note } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Título y fecha requeridos' });
    const ev = { id: genId(), title, date, time: time||'', note: note||'', createdBy: req.user.name, ts: new Date() };
    space.agenda.push(ev);
    await space.save();
    res.json(ev);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/:spaceId/agenda/:evId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    space.agenda = space.agenda.filter(e => e.id !== req.params.evId);
    await space.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ====== NOTAS ======
router.post('/:spaceId/notas', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const { title, body } = req.body;
    const nota = { id: genId(), title: title||'', body: body||'', createdBy: req.user.name, date: new Date().toLocaleDateString('es-ES'), ts: new Date() };
    space.notas.push(nota);
    await space.save();
    res.json(nota);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/:spaceId/notas/:notaId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    const nota = space.notas.find(n => n.id === req.params.notaId);
    if (!nota) return res.status(404).json({ error: 'No encontrada' });
    nota.title = req.body.title || nota.title;
    nota.body = req.body.body || nota.body;
    nota.date = new Date().toLocaleDateString('es-ES');
    await space.save();
    res.json(nota);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/:spaceId/notas/:notaId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });
    space.notas = space.notas.filter(n => n.id !== req.params.notaId);
    await space.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
