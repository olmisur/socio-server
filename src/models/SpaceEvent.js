// Eventos de agenda, separados del documento Space
const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  notifiedAt: { type: Date, default: null }
}, { _id: false });

const spaceEventSchema = new mongoose.Schema({
  spaceId:    { type: String, required: true },
  id:         { type: String, required: true },
  title:      { type: String, required: true },
  date:       { type: String, required: true },
  time:       { type: String, default: '' },
  timeZone:   { type: String, default: 'Europe/Madrid' },
  note:       { type: String, default: '' },
  createdBy:  { type: String, default: '' },
  reminders:  { type: [reminderSchema], default: [] },
  // Campos legacy — mantenidos para migración desde documentos Space embebidos
  notifyUserId: { type: String, default: null },
  notified:     { type: Boolean, default: false },
  ts:           { type: Date, default: Date.now }
});

spaceEventSchema.index({ spaceId: 1, date: 1 });
spaceEventSchema.index({ spaceId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('SpaceEvent', spaceEventSchema);
