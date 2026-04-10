const express = require('express');
const webpush = require('web-push');
const User = require('../models/User');
const Space = require('../models/Space');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Setup VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@socio.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// GET VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Save push subscription for user
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { subscription } = req.body;
    await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Error guardando suscripción' });
  }
});

// Toggle notification for an event
router.post('/event-notif', authMiddleware, async (req, res) => {
  try {
    const { spaceId, eventId, enabled } = req.body;
    const space = await Space.findOne({ id: spaceId });
    if (!space) return res.status(404).json({ error: 'Espacio no encontrado' });
    const ev = space.agenda.find(e => e.id === eventId);
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
    ev.notifyUserId = enabled ? req.user._id.toString() : null;
    ev.notified = false;
    await space.save();
    res.json({ ok: true, enabled });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

// Scheduler - check every 5 minutes
async function checkNotifications() {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in25 = new Date(now.getTime() + 25 * 60 * 1000);

    const spaces = await Space.find({ 'agenda.notifyUserId': { $ne: null } });

    for (const space of spaces) {
      for (const ev of space.agenda) {
        if (!ev.notifyUserId || ev.notified) continue;

        const evDate = new Date(`${ev.date}T${ev.time || '00:00'}:00`);
        if (evDate >= in25 && evDate <= in30) {
          // Send notification
          const user = await User.findById(ev.notifyUserId);
          if (!user?.pushSubscription) continue;

          try {
            await webpush.sendNotification(
              user.pushSubscription,
              JSON.stringify({
                title: '⏰ Socio te recuerda',
                body: `En 30 min: ${ev.title}`,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                data: { url: '/' }
              })
            );
            ev.notified = true;
            console.log(`✅ Notificación enviada: ${ev.title} a ${user.name}`);
          } catch (e) {
            console.error('Error enviando push:', e.message);
            if (e.statusCode === 410) {
              // Subscription expired
              await User.findByIdAndUpdate(ev.notifyUserId, { pushSubscription: null });
            }
          }
        }
      }
      await space.save();
    }
  } catch (e) {
    console.error('Error en checkNotifications:', e.message);
  }
}

// Start scheduler
function startScheduler() {
  console.log('🔔 Scheduler de notificaciones iniciado (cada 5 min)');
  checkNotifications(); // Run once on start
  setInterval(checkNotifications, 5 * 60 * 1000);
}

module.exports = { router, startScheduler };
