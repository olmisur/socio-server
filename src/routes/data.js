const express = require('express');
const Space = require('../models/Space');
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

async function getSpace(spaceId, userId) {
  const safeSpaceId = requiredString(spaceId, 'Espacio invalido', { min: 3, max: 120 });
  const space = await Space.findOne({ id: safeSpaceId });
  if (!space) return null;

  const isMember = space.members.find(member => member.userId === userId.toString());
  return isMember ? space : null;
}

router.get('/:spaceId', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    return res.json({
      compra: space.compra,
      tareas: space.tareas,
      agenda: space.agenda.map(event => serializeAgendaEvent(event, req.user._id)),
      notas: space.notas,
      members: space.members.map(member => ({ name: member.name, role: member.role })),
      inviteCode: space.inviteCode
    });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error al obtener datos' });
  }
});

router.post('/:spaceId/compra', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 120 }).toLowerCase();
    const item = { id: genId(), name, done: false, addedBy: req.user.name, ts: new Date() };

    space.compra.push(item);
    await space.save();
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
    const item = space.compra.find(entry => entry.id === itemId);

    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    item.done = done;
    await space.save();
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
    space.compra = space.compra.filter(item => item.id !== itemId);
    await space.save();
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

    if (req.query.done === 'true') space.compra = space.compra.filter(item => !item.done);
    else space.compra = [];

    await space.save();
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.post('/:spaceId/tareas', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 160 });
    const item = { id: genId(), name, done: false, addedBy: req.user.name, ts: new Date() };

    space.tareas.push(item);
    await space.save();
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
    const item = space.tareas.find(entry => entry.id === itemId);

    if (!item) return res.status(404).json({ error: 'No encontrado' });

    const hasDone = Object.prototype.hasOwnProperty.call(body, 'done');
    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    if (!hasDone && !hasName) return res.status(400).json({ error: 'Sin cambios validos' });

    if (hasDone) item.done = requiredBoolean(body.done, 'Estado invalido');
    if (hasName) item.name = requiredString(body.name, 'Nombre requerido', { min: 1, max: 160 });

    await space.save();
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
    space.tareas = space.tareas.filter(item => item.id !== itemId);
    await space.save();
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

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

    const event = {
      id: genId(),
      title,
      date,
      time,
      timeZone,
      note,
      createdBy: req.user.name,
      reminders: [],
      ts: new Date()
    };

    space.agenda.push(event);
    await space.save();
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
    const event = space.agenda.find(entry => entry.id === eventId);

    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

    const title = requiredString(body.title, 'Titulo y fecha requeridos', { min: 1, max: 160 });
    const date = isoDate(body.date, 'Fecha invalida');
    const time = hhmmTime(body.time, 'Hora invalida');
    const note = optionalString(body.note, 'Nota invalida', { max: 500 });

    event.title = title;
    event.date = date;
    event.time = time;
    event.note = note;
    if (Object.prototype.hasOwnProperty.call(body, 'timeZone')) {
      event.timeZone = normalizeTimeZone(body.timeZone);
    }

    await space.save();
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
    space.agenda = space.agenda.filter(event => event.id !== eventId);
    await space.save();
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.post('/:spaceId/notas', authMiddleware, async (req, res) => {
  try {
    const space = await getSpace(req.params.spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const body = ensureObject(req.body);
    const title = optionalString(body.title, 'Titulo invalido', { max: 120 });
    const noteBody = optionalString(body.body, 'Contenido invalido', { max: 5000 });
    if (!title && !noteBody) return res.status(400).json({ error: 'La nota esta vacia' });

    const note = {
      id: genId(),
      title,
      body: noteBody,
      createdBy: req.user.name,
      date: new Date().toLocaleDateString('es-ES'),
      ts: new Date()
    };

    space.notas.push(note);
    await space.save();
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
    const note = space.notas.find(entry => entry.id === noteId);

    if (!note) return res.status(404).json({ error: 'No encontrada' });

    const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
    const hasBody = Object.prototype.hasOwnProperty.call(body, 'body');
    if (!hasTitle && !hasBody) return res.status(400).json({ error: 'Sin cambios validos' });

    const nextTitle = hasTitle ? optionalString(body.title, 'Titulo invalido', { max: 120 }) : note.title;
    const nextBody = hasBody ? optionalString(body.body, 'Contenido invalido', { max: 5000 }) : note.body;
    if (!nextTitle && !nextBody) return res.status(400).json({ error: 'La nota esta vacia' });

    note.title = nextTitle;
    note.body = nextBody;
    note.date = new Date().toLocaleDateString('es-ES');

    await space.save();
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
    space.notas = space.notas.filter(note => note.id !== noteId);
    await space.save();
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
