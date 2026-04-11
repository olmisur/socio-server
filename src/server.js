require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { startScheduler } = require('./routes/notifications');
const logger = require('./utils/logger');

// Captura de errores no controlados para evitar caídas silenciosas
process.on('uncaughtException', err => {
  logger.error('uncaughtException', { msg: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { msg: String(reason) });
});

const app = createApp();

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    logger.info('MongoDB conectado');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info('Socio iniciado', { port: PORT });
      startScheduler();
    });
  })
  .catch(err => {
    logger.error('Error conectando MongoDB', { msg: err.message });
    process.exit(1);
  });
