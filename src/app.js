const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const aiRoutes = require('./routes/ai');
const { router: notifRoutes } = require('./routes/notifications');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(path.join(__dirname, '../public')));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
  app.use('/api/', limiter);
  app.use('/api/ai', aiLimiter);

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
    const ok = dbState === 1;
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      db: dbStatus,
      ts: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/notif', notifRoutes);

  // ── Error handler global ────────────────────────────────────────────────────
  app.use((err, req, res, _next) => {
    logger.error('Unhandled error', { method: req.method, url: req.url, msg: err.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  return app;
}

module.exports = { createApp };
