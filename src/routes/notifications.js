const express = require('express');
const cron = require('node-cron');
const webpush = require('web-push');
const User = require('../models/User');
const Space = require('../models/Space');
const SpaceEvent = require('../models/SpaceEvent');
const SpaceItem = require('../models/SpaceItem');
const SpaceRecurring = require('../models/SpaceRecurring');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const {
  DEFAULT_TIMEZONE,
  ensureReminderCollection,
  getReminderForUser,
  normalizeTimeZone,
  setReminderForUser,
  zonedDateTimeToUtc
} = require('../utils/agendaNotifications');
const {
  ensureObject,
  requiredBoolean,
  requiredString,
  safeError
} = require('../utils/requestValidation');

const router = express.Router();
const hasVapidConfig = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let lastCheckAt = null;
let schedulerStartedAt = null;
let schedulerTask = null;
let checkRunning = false; // evita ejecuciones solapadas

if (hasVapidConfig) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@socio.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
async function getSpaceForUser(spaceId, userId) {
  const safeSpaceId = requiredString(spaceId, 'Espacio invalido', { min: 3, max: 120 });
  const space = await Space.findOne({ id: safeSpaceId });
  if (!space) return null;
  const isMember = space.members.some(m => m.userId === String(userId));
  return isMember ? space : null;
}

function summarizeSubscription(subscription) {
  if (!subscription?.endpoint) return { hasSubscription: false };
  let endpointHost = null;
  try { endpointHost = new URL(subscription.endpoint).host; } catch {}
  return {
    hasSubscription: true,
    endpointHost,
    endpointTail: subscription.endpoint.slice(-18),
    hasP256dh: Boolean(subscription.keys?.p256dh),
    hasAuth: Boolean(subscription.keys?.auth)
  };
}

async function sendPushToUser(user, payload) {
  if (!user?.pushSubscription) return { ok: false, reason: 'missing_subscription' };
  try {
    await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    logger.error('Error enviando push', { userId: user._id, msg: error.message, statusCode: error.statusCode });
    if (error.statusCode === 404 || error.statusCode === 410) {
      await User.findByIdAndUpdate(user._id, { pushSubscription: null });
    }
    return { ok: false, reason: 'send_failed', statusCode: error.statusCode || null, message: error.message };
  }
}

// ── Rutas ──────────────────────────────────────────────────────────────────────
router.get('/vapid-key', (req, res) => {
  if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });
    const body = ensureObject(req.body);
    const subscription = ensureObject(body.subscription, 'Suscripcion invalida');
    const isValid = Boolean(subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth);
    if (!isValid) return res.status(400).json({ error: 'Suscripcion invalida' });
    await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error guardando suscripcion' });
  }
});

router.post('/event-notif', authMiddleware, async (req, res) => {
  try {
    if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });
    const body = ensureObject(req.body);
    const spaceId = requiredString(body.spaceId, 'Espacio invalido', { min: 3, max: 120 });
    const eventId = requiredString(body.eventId, 'Evento invalido', { min: 3, max: 120 });
    const enabled = requiredBoolean(body.enabled, 'Valor de aviso invalido');
    const space = await getSpaceForUser(spaceId, req.user._id);
    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const event = await SpaceEvent.findOne({ spaceId: space.id, id: eventId });
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

    setReminderForUser(event, req.user._id, Boolean(enabled));
    await event.save();
    return res.json({ ok: true, enabled: Boolean(enabled) });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error' });
  }
});

router.get('/debug', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('pushSubscription');
    const response = {
      nowUtc: new Date().toISOString(),
      appTimeZone: DEFAULT_TIMEZONE,
      hasVapidConfig,
      schedulerStartedAt,
      lastCheckAt,
      schedulerRunning: Boolean(schedulerTask),
    };

    const spaceId = req.query.spaceId ? requiredString(req.query.spaceId, 'Espacio invalido', { min: 3, max: 120 }) : '';
    const eventId = req.query.eventId ? requiredString(req.query.eventId, 'Evento invalido', { min: 3, max: 120 }) : '';

    if (!spaceId || !eventId) return res.json({ ...response, user: summarizeSubscription(user?.pushSubscription) });

    const space = await getSpaceForUser(spaceId, req.user._id);
    if (!space) return res.status(403).json({ ...response, error: 'Sin acceso al espacio' });

    const event = await SpaceEvent.findOne({ spaceId: space.id, id: eventId });
    if (!event) return res.status(404).json({ ...response, error: 'Evento no encontrado' });

    const eventAtUtc = zonedDateTimeToUtc(event.date, event.time || '00:00', normalizeTimeZone(event.timeZone || DEFAULT_TIMEZONE));
    const reminder = getReminderForUser(event, req.user._id);
    const reminderWindowStart = eventAtUtc ? new Date(eventAtUtc.getTime() - 30 * 60 * 1000) : null;
    const reminderWindowEnd   = eventAtUtc ? new Date(eventAtUtc.getTime() - 25 * 60 * 1000) : null;

    return res.json({
      ...response,
      user: summarizeSubscription(user?.pushSubscription),
      event: {
        id: event.id, title: event.title, date: event.date,
        time: event.time || '00:00',
        timeZone: normalizeTimeZone(event.timeZone || DEFAULT_TIMEZONE),
        eventAtUtc: eventAtUtc?.toISOString() || null,
        reminderEnabled: Boolean(reminder),
        remindedAt: reminder?.notifiedAt ? new Date(reminder.notifiedAt).toISOString() : null,
        reminderWindowStartUtc: reminderWindowStart?.toISOString() || null,
        reminderWindowEndUtc:   reminderWindowEnd?.toISOString()   || null
      }
    });
  } catch (e) {
    if (e?.status) return safeError(res, e);
    return res.status(500).json({ error: 'Error en diagnostico' });
  }
});

router.post('/test', authMiddleware, async (req, res) => {
  try {
    if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });
    const user = await User.findById(req.user._id).select('name pushSubscription');
    if (!user?.pushSubscription) return res.status(400).json({ error: 'No hay suscripcion push guardada' });
    const result = await sendPushToUser(user, {
      title: 'Prueba de Socio',
      body: 'Si ves esto en el movil, el canal push funciona.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `test-${user._id}-${Date.now()}`,
      data: { url: '/' }
    });
    if (!result.ok) return res.status(502).json({ error: 'No se pudo enviar la notificacion de prueba', detail: result });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Error enviando prueba push' });
  }
});

router.post('/check-now', authMiddleware, async (req, res) => {
  try {
    await checkNotifications();
    return res.json({ ok: true, lastCheckAt });
  } catch (e) {
    return res.status(500).json({ error: 'Error ejecutando scheduler manualmente' });
  }
});

// ── Scheduler ──────────────────────────────────────────────────────────────────
async function checkNotifications() {
  if (checkRunning) {
    logger.warn('Scheduler: ejecucion anterior aun en curso, saltando');
    return;
  }
  checkRunning = true;
  try {
    if (!hasVapidConfig) return;
    lastCheckAt = new Date().toISOString();

    const now = new Date();
    const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000);

    // Consulta directa sobre la colección de eventos en lugar de cargar todos los Spaces
    const events = await SpaceEvent.find({
      $or: [
        { 'reminders.0': { $exists: true } },
        { notifyUserId: { $ne: null } }
      ]
    });

    for (const event of events) {
      const reminders = ensureReminderCollection(event);
      if (!reminders.length) continue;

      const eventAt = zonedDateTimeToUtc(
        event.date,
        event.time || '00:00',
        normalizeTimeZone(event.timeZone || DEFAULT_TIMEZONE)
      );
      if (!eventAt || eventAt < windowStart || eventAt > windowEnd) continue;

      for (const reminder of reminders) {
        if (reminder.notifiedAt) continue;
        const user = await User.findById(reminder.userId);
        if (!user?.pushSubscription) continue;

        const result = await sendPushToUser(user, {
          title: 'Socio te recuerda',
          body: `En 30 min: ${event.title}`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: `agenda-${event.id}-${reminder.userId}`,
          data: { url: '/' }
        });

        if (result.ok) {
          reminder.notifiedAt = new Date();
          logger.info('Notificacion enviada', { event: event.title, user: user.name });
        }
      }

      if (event.isModified()) await event.save();
    }
  } catch (e) {
    logger.error('Error en checkNotifications', { msg: e.message });
  } finally {
    checkRunning = false;
  }
}

// ── Resumen matutino ───────────────────────────────────────────────────────────
function getTodayMadrid() {
  return new Date().toLocaleDateString('en-CA', { timeZone: DEFAULT_TIMEZONE }); // YYYY-MM-DD
}

async function sendMorningSummary() {
  try {
    if (!hasVapidConfig) return;
    const today = getTodayMadrid();
    const events = await SpaceEvent.find({ date: today }).sort({ time: 1 });
    if (!events.length) return;

    // Agrupar eventos por usuario (un usuario puede estar en varios espacios)
    const userEvents = {}; // userId → SpaceEvent[]
    const spaceCache = {};
    for (const ev of events) {
      if (!spaceCache[ev.spaceId]) spaceCache[ev.spaceId] = await Space.findOne({ id: ev.spaceId });
      const space = spaceCache[ev.spaceId];
      if (!space) continue;
      for (const member of space.members) {
        if (!userEvents[member.userId]) userEvents[member.userId] = [];
        userEvents[member.userId].push(ev);
      }
    }

    for (const [userId, userEvs] of Object.entries(userEvents)) {
      const user = await User.findById(userId);
      if (!user?.pushSubscription) continue;
      const list = userEvs.map(ev => `${ev.title}${ev.time ? ` (${ev.time})` : ''}`).join(', ');
      const body = userEvs.length === 1
        ? `Un evento hoy: ${list}`
        : `${userEvs.length} eventos hoy: ${list}`;
      const result = await sendPushToUser(user, {
        title: 'Buenos días 👋',
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `morning-${today}`,
        data: { url: '/' }
      });
      if (result.ok) logger.info('Resumen matutino enviado', { userId, count: userEvs.length });
    }
  } catch (e) {
    logger.error('Error en sendMorningSummary', { msg: e.message });
  }
}

// ── Tareas recurrentes ─────────────────────────────────────────────────────────
function matchesToday(pattern) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: DEFAULT_TIMEZONE }));
  const dow = now.getDay();   // 0=dom..6=sáb
  const dom = now.getDate();  // 1-31
  if (pattern === 'daily') return true;
  if (pattern.startsWith('weekly:')) return parseInt(pattern.split(':')[1]) === dow;
  if (pattern.startsWith('monthly:')) return parseInt(pattern.split(':')[1]) === dom;
  return false;
}

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

async function createRecurringInstances() {
  try {
    const today = getTodayMadrid();
    const actives = await SpaceRecurring.find({ active: true });
    for (const rec of actives) {
      if (rec.lastCreated === today) continue; // ya creada hoy
      if (!matchesToday(rec.pattern)) continue;
      await SpaceItem.create({
        spaceId: rec.spaceId, type: rec.type, id: genId(),
        name: rec.name, done: false, addedBy: rec.addedBy
      });
      rec.lastCreated = today;
      await rec.save();
      logger.info('Tarea recurrente creada', { name: rec.name, spaceId: rec.spaceId });
    }
  } catch (e) {
    logger.error('Error en createRecurringInstances', { msg: e.message });
  }
}

// ── Arranque del scheduler ─────────────────────────────────────────────────────
function startScheduler() {
  if (!hasVapidConfig) {
    logger.warn('Scheduler de notificaciones desactivado: faltan claves VAPID');
  } else {
    if (!schedulerTask) {
      schedulerStartedAt = new Date().toISOString();
      schedulerTask = cron.schedule('*/5 * * * *', checkNotifications, { timezone: DEFAULT_TIMEZONE });
      logger.info('Scheduler de notificaciones iniciado (cada 5 min, cron)');
      checkNotifications();
    }
    // Resumen matutino a las 8:00
    cron.schedule('0 8 * * *', sendMorningSummary, { timezone: DEFAULT_TIMEZONE });
    logger.info('Resumen matutino activado (08:00)');
  }

  // Tareas recurrentes a las 00:05 (independiente de VAPID)
  cron.schedule('5 0 * * *', createRecurringInstances, { timezone: DEFAULT_TIMEZONE });
  logger.info('Scheduler de recurrentes iniciado (00:05)');
  createRecurringInstances(); // primera pasada al arrancar
}

module.exports = { router, startScheduler };
