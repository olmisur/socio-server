require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const aiRoutes = require('./routes/ai');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use('/api/', limiter);
app.use('/api/ai', aiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/ai', aiRoutes);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB conectado');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🤝 Socio corriendo en puerto ${PORT}`));
  })
  .catch(err => {
    console.error('❌ Error MongoDB:', err);
    process.exit(1);
  });
