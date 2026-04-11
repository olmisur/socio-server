const express = require('express');
const webpush = require('web-push');
const User = require('../models/User');
const Space = require('../models/Space');
const authMiddleware = require('../middleware/auth');
const {
  DEFAULT_TIMEZONE,
  ensureReminderCollection,
  getReminderForUser,
  normalizeTimeZone,
  setReminderForUser,
  zonedDateTimeToUtc
} = require('../utils/agendaNotifications');

const router = express.Router();
const hasVapidConfig = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
let lastCheckAt = null;
let schedulerStartedAt = null;
let schedulerTimer = null;

if (hasVapidConfig) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@socio.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function getSpaceForUser(spaceId, userId) {
  const space = await Space.findOne({ id: spaceId });
  if (!space) return null;

  const isMember = space.members.some(member => member.userId === String(userId));
  return isMember ? space : null;
}

function summarizeSubscription(subscription) {
  if (!subscription?.endpoint) {
    return {
      hasSubscription: false
    };
  }

  let endpointHost = null;
  try {
    endpointHost = new URL(subscription.endpoint).host;
  } catch {
    endpointHost = null;
  }

  return {
    hasSubscription: true,
    endpointHost,
    endpointTail: subscription.endpoint.slice(-18),
    hasP256dh: Boolean(subscription.keys?.p256dh),
    hasAuth: Boolean(subscription.keys?.auth)
  };
}

async function sendPushToUser(user, payload) {
  if (!user?.pushSubscription) {
    return { ok: false, reason: 'missing_subscription' };
  }

  try {
    await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    console.error('Error enviando push:', error.message);

    if (error.statusCode === 404 || error.statusCode === 410) {
      await User.findByIdAndUpdate(user._id, { pushSubscription: null });
    }

    return {
      ok: false,
      reason: 'send_failed',
      statusCode: error.statusCode || null,
      message: error.message
    };
  }
}

router.get('/vapid-key', (req, res) => {
  if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });

    const { subscription } = req.body;
    const isValidSubscription = Boolean(
      subscription?.endpoint &&
      subscription?.keys?.p256dh &&
      subscription?.keys?.auth
    );

    if (!isValidSubscription) {
      return res.status(400).json({ error: 'Suscripcion invalida' });
    }

    await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Error guardando suscripcion' });
  }
});

router.post('/event-notif', authMiddleware, async (req, res) => {
  try {
    if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });

    const { spaceId, eventId, enabled } = req.body;
    const space = await getSpaceForUser(spaceId, req.user._id);

    if (!space) return res.status(403).json({ error: 'Sin acceso' });

    const event = space.agenda.find(entry => entry.id === eventId);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

    setReminderForUser(event, req.user._id, Boolean(enabled));
    await space.save();

    return res.json({ ok: true, enabled: Boolean(enabled) });
  } catch (e) {
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
      schedulerRunning: Boolean(schedulerTimer),
      user: summarizeSubscription(user?.pushSubscription)
    };

    const { spaceId, eventId } = req.query;
    if (!spaceId || !eventId) {
      return res.json(response);
    }

    const space = await getSpaceForUser(spaceId, req.user._id);
    if (!space) {
      return res.status(403).json({ ...response, error: 'Sin acceso al espacio' });
    }

    const event = space.agenda.find(entry => entry.id === eventId);
    if (!event) {
      return res.status(404).json({ ...response, error: 'Evento no encontrado' });
    }

    const eventAtUtc = zonedDateTimeToUtc(
      event.date,
      event.time || '00:00',
      normalizeTimeZone(event.timeZone || DEFAULT_TIMEZONE)
    );
    const reminder = getReminderForUser(event, req.user._id);
    const reminderWindowStart = eventAtUtc ? new Date(eventAtUtc.getTime() - 30 * 60 * 1000) : null;
    const reminderWindowEnd = eventAtUtc ? new Date(eventAtUtc.getTime() - 25 * 60 * 1000) : null;

    return res.json({
      ...response,
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time || '00:00',
        timeZone: normalizeTimeZone(event.timeZone || DEFAULT_TIMEZONE),
        eventAtUtc: eventAtUtc ? eventAtUtc.toISOString() : null,
        reminderEnabled: Boolean(reminder),
        remindedAt: reminder?.notifiedAt ? new Date(reminder.notifiedAt).toISOString() : null,
        reminderWindowStartUtc: reminderWindowStart ? reminderWindowStart.toISOString() : null,
        reminderWindowEndUtc: reminderWindowEnd ? reminderWindowEnd.toISOString() : null
      }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Error en diagnostico' });
  }
});

router.post('/test', authMiddleware, async (req, res) => {
  try {
    if (!hasVapidConfig) return res.status(503).json({ error: 'Push no configurado' });

    const user = await User.findById(req.user._id).select('name pushSubscription');
    if (!user?.pushSubscription) {
      return res.status(400).json({ error: 'No hay suscripcion push guardada para este usuario' });
    }

    const result = await sendPushToUser(user, {
      title: 'Prueba de Socio',
      body: 'Si ves esto en el movil, el canal push funciona.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `test-${user._id}-${Date.now()}`,
      data: { url: '/' }
    });

    if (!result.ok) {
      return res.status(502).json({
        error: 'No se pudo enviar la notificacion de prueba',
        detail: result
      });
    }

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

async function checkNotifications() {
  try {
    if (!hasVapidConfig) return;
    lastCheckAt = new Date().toISOString();

    const now = new Date();
    const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);

    const spaces = await Space.find({
      $or: [
        { 'agenda.reminders.0': { $exists: true } },
        { 'agenda.notifyUserId': { $ne: null } }
      ]
    });

    for (const space of spaces) {
      for (const event of space.agenda) {
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
            console.log(`Notificacion enviada: ${event.title} a ${user.name}`);
          }
        }
      }

      if (space.isModified()) await space.save();
    }
  } catch (e) {
    console.error('Error en checkNotifications:', e.message);
  }
}

function startScheduler() {
  if (!hasVapidConfig) {
    console.log('Scheduler de notificaciones desactivado: faltan claves VAPID');
    return;
  }

  if (schedulerTimer) return;

  schedulerStartedAt = new Date().toISOString();
  console.log('Scheduler de notificaciones iniciado (cada 5 min)');
  checkNotifications();
  schedulerTimer = setInterval(checkNotifications, 5 * 60 * 1000);
}

module.exports = { router, startScheduler };
