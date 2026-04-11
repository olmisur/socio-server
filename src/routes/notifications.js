const express = require('express');
const webpush = require('web-push');
const User = require('../models/User');
const Space = require('../models/Space');
const authMiddleware = require('../middleware/auth');
const {
  DEFAULT_TIMEZONE,
  ensureReminderCollection,
  normalizeTimeZone,
  setReminderForUser,
  zonedDateTimeToUtc
} = require('../utils/agendaNotifications');

const router = express.Router();
const hasVapidConfig = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

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

async function checkNotifications() {
  try {
    if (!hasVapidConfig) return;

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

          try {
            await webpush.sendNotification(
              user.pushSubscription,
              JSON.stringify({
                title: 'Socio te recuerda',
                body: `En 30 min: ${event.title}`,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `agenda-${event.id}-${reminder.userId}`,
                data: { url: '/' }
              })
            );

            reminder.notifiedAt = new Date();
            console.log(`Notificacion enviada: ${event.title} a ${user.name}`);
          } catch (error) {
            console.error('Error enviando push:', error.message);

            if (error.statusCode === 404 || error.statusCode === 410) {
              await User.findByIdAndUpdate(reminder.userId, { pushSubscription: null });
            }
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

  console.log('Scheduler de notificaciones iniciado (cada 5 min)');
  checkNotifications();
  setInterval(checkNotifications, 5 * 60 * 1000);
}

module.exports = { router, startScheduler };
