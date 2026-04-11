const express = require('express');
const Space = require('../models/Space');
const SpaceItem = require('../models/SpaceItem');
const SpaceEvent = require('../models/SpaceEvent');
const SpaceNote = require('../models/SpaceNote');
const SpaceExpense = require('../models/SpaceExpense');
const SpaceRecurring = require('../models/SpaceRecurring');
const authMiddleware = require('../middleware/auth');
const { normalizeTimeZone, serializeAgendaEvent } = require('../utils/agendaNotifications');
const {
  ensureObject,
  hhmmTime,
  isoDate,
  optionalString,
  requiredBoolean,
  requiredString,
  safeError
} = require('../utils/requestValidation');

const router = express.Router();

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// Verifica que el usuario es miembro del espacio y devuelve el documento Space
async function getSpace(spaceId, userId) {
  const safeSpaceId = requiredString(spaceId, 'Espacio invalido', { min: 3, max: 120 });
  const space = await Space.findOne({ id: safeSpaceId });
  if (!space) return null;
  const isMember = space.members.find(m => m.userId === userId.toString());
  return isMember ? space : null;
}

// ── GET espacio ────────────────────────────────────────────────────────────────
router.get('/:spaceId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const [compra, tareas, agenda, notas, gastos, recurrentes] = await Promise.all([
      SpaceItem.find({ spaceId: space.id, type: 'compra' }).sort({ ts: 1 }),
      SpaceItem.find({ spaceId: space.id, type: 'tareas' }).sort({ ts: 1 }),
      SpaceEvent.find({ spaceId: space.id }).sort({ date: 1, time: 1 }),
      SpaceNote.find({ spaceId: space.id }).sort({ ts: 1 }),
      SpaceExpense.find({ spaceId: space.id }).sort({ ts: -1 }),
      SpaceRecurring.find({ spaceId: space.id, active: true }).sort({ ts: 1 })
    ]);

    return res.json({
      compra,
      tareas,
      agenda: agenda.map(ev => serializeAgendaEvent(ev, req.user._id)),
      notas,
      gastos,
      recurrentes,
      members: space.members.map(m => ({ name: m.name, role: m.role })),
      inviteCode: space.inviteCode
    });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// ── COMPRA ─────────────────────────────────────────────────────────────────────
router.post('/:spaceId/compra', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 120 }).toLowerCase();
    const item = await SpaceItem.create({ spaceId: space.id, type: 'compra', id: genId(), name, done: false, addedBy: req.user.name });
    return res.json(item);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.patch('/:spaceId/compra/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const itemId = requiredString(req.params.itemId, 'Item invalido', { min: 3, max: 120 });
    const body = ensureObject(req.body);
    const done = requiredBoolean(body.done, 'Estado invalido');
    const item = await SpaceItem.findOneAndUpdate({ spaceId: space.id, type: 'compra', id: itemId }, { done }, { new: true });
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    return res.json(item);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/compra/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const itemId = requiredString(req.params.itemId, 'Item invalido', { min: 3, max: 120 });
    await SpaceItem.deleteOne({ spaceId: space.id, type: 'compra', id: itemId });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/compra', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    if (req.query.done != null && req.query.done !== 'true') {
      return res.status(400).json({ error: 'Filtro invalido' });
    }

    const filter = { spaceId: space.id, type: 'compra' };
    if (req.query.done === 'true') filter.done = true;
    await SpaceItem.deleteMany(filter);
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

// ── TAREAS ─────────────────────────────────────────────────────────────────────
router.post('/:spaceId/tareas', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 160 });
    const item = await SpaceItem.create({ spaceId: space.id, type: 'tareas', id: genId(), name, done: false, addedBy: req.user.name });
    return res.json(item);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.patch('/:spaceId/tareas/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const itemId = requiredString(req.params.itemId, 'Tarea invalida', { min: 3, max: 120 });
    const body = ensureObject(req.body);
    const item = await SpaceItem.findOne({ spaceId: space.id, type: 'tareas', id: itemId });
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const hasDone = Object.prototype.hasOwnProperty.call(body, 'done');
    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    if (!hasDone && !hasName) return res.status(400).json({ error: 'Sin cambios validos' });

    if (hasDone) item.done = requiredBoolean(body.done, 'Estado invalido');
    if (hasName) item.name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 160 });
    await item.save();
    return res.json(item);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/tareas/:itemId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const itemId = requiredString(req.params.itemId, 'Tarea invalida', { min: 3, max: 120 });
    await SpaceItem.deleteOne({ spaceId: space.id, type: 'tareas', id: itemId });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

// ── AGENDA ─────────────────────────────────────────────────────────────────────
router.post('/:spaceId/agenda', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const title = requiredString(body.title, 'Titulo y fecha requeridos', { min: 1, max: 160 });
    const date = isoDate(body.date, 'Fecha invalida');
    const time = hhmmTime(body.time, 'Hora invalida');
    const note = optionalString(body.note, 'Nota invalida', { max: 500 });
    const timeZone = normalizeTimeZone(body.timeZone);

    const event = await SpaceEvent.create({ spaceId: space.id, id: genId(), title, date, time, timeZone, note, createdBy: req.user.name, reminders: [] });
    return res.json(serializeAgendaEvent(event, req.user._id));
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.put('/:spaceId/agenda/:evId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const eventId = requiredString(req.params.evId, 'Evento invalido', { min: 3, max: 120 });
    const body = ensureObject(req.body);
    const event = await SpaceEvent.findOne({ spaceId: space.id, id: eventId });
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

    event.title = requiredString(body.title, 'Titulo y fecha requeridos', { min: 1, max: 160 });
    event.date  = isoDate(body.date, 'Fecha invalida');
    event.time  = hhmmTime(body.time, 'Hora invalida');
    event.note  = optionalString(body.note, 'Nota invalida', { max: 500 });
    if (Object.prototype.hasOwnProperty.call(body, 'timeZone')) {
      event.timeZone = normalizeTimeZone(body.timeZone);
    }
    await event.save();
    return res.json(serializeAgendaEvent(event, req.user._id));
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/agenda/:evId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const eventId = requiredString(req.params.evId, 'Evento invalido', { min: 3, max: 120 });
    await SpaceEvent.deleteOne({ spaceId: space.id, id: eventId });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

// ── NOTAS ──────────────────────────────────────────────────────────────────────
router.post('/:spaceId/notas', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const title = optionalString(body.title, 'Titulo invalido', { max: 120 });
    const noteBody = optionalString(body.body, 'Contenido invalido', { max: 5000 });
    if (!title && !noteBody) return res.status(400).json({ error: 'La nota esta vacia' });

    const note = await SpaceNote.create({ spaceId: space.id, id: genId(), title, body: noteBody, createdBy: req.user.name, date: new Date().toLocaleDateString('es-ES') });
    return res.json(note);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.put('/:spaceId/notas/:notaId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const noteId = requiredString(req.params.notaId, 'Nota invalida', { min: 3, max: 120 });
    const body = ensureObject(req.body);
    const note = await SpaceNote.findOne({ spaceId: space.id, id: noteId });
    if (!note) return res.status(404).json({ error: 'No encontrada' });

    const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
    const hasBody  = Object.prototype.hasOwnProperty.call(body, 'body');
    if (!hasTitle && !hasBody) return res.status(400).json({ error: 'Sin cambios validos' });

    const nextTitle = hasTitle ? optionalString(body.title, 'Titulo invalido', { max: 120 }) : note.title;
    const nextBody  = hasBody  ? optionalString(body.body,  'Contenido invalido', { max: 5000 }) : note.body;
    if (!nextTitle && !nextBody) return res.status(400).json({ error: 'La nota esta vacia' });

    note.title = nextTitle;
    note.body  = nextBody;
    note.date  = new Date().toLocaleDateString('es-ES');
    await note.save();
    return res.json(note);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/notas/:notaId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const noteId = requiredString(req.params.notaId, 'Nota invalida', { min: 3, max: 120 });
    await SpaceNote.deleteOne({ spaceId: space.id, id: noteId });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

// ── GASTOS ─────────────────────────────────────────────────────────────────────
router.post('/:spaceId/gastos', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const description = requiredString(body.description, 'Descripción requerida', { min: 1, max: 160 });
    const rawAmount = parseFloat(body.amount);
    if (!isFinite(rawAmount) || rawAmount <= 0) return res.status(400).json({ error: 'Importe inválido' });
    const amount = Math.round(rawAmount * 100) / 100;
    const category = optionalString(body.category, 'Categoría inválida', { max: 60 }) || 'general';

    const expense = await SpaceExpense.create({ spaceId: space.id, id: genId(), amount, description, category, addedBy: req.user.name });
    return res.json(expense);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/gastos/:expId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const expId = requiredString(req.params.expId, 'Gasto inválido', { min: 3, max: 120 });
    await SpaceExpense.deleteOne({ spaceId: space.id, id: expId });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

// ── RECURRENTES ────────────────────────────────────────────────────────────────
const VALID_PATTERNS = /^(daily|weekly:[0-6]|monthly:([1-9]|[12]\d|3[01]))$/;

router.post('/:spaceId/recurrentes', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 160 });
    const type = body.type === 'compra' ? 'compra' : 'tareas';
    const pattern = requiredString(body.pattern, 'Patrón inválido', { min: 4, max: 20 });
    if (!VALID_PATTERNS.test(pattern)) return res.status(400).json({ error: 'Patrón inválido' });

    const recurring = await SpaceRecurring.create({ spaceId: space.id, id: genId(), name, type, pattern, addedBy: req.user.name });
    return res.json(recurring);
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.delete('/:spaceId/recurrentes/:recId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const recId = requiredString(req.params.recId, 'Recurrente inválido', { min: 3, max: 120 });
    await SpaceRecurring.deleteOne({ spaceId: space.id, id: recId });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
