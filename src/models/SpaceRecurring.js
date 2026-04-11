// Tareas y compras recurrentes — plantillas que el scheduler materializa cada día
// Patrones: 'daily' | 'weekly:N' (0=dom..6=sáb) | 'monthly:N' (día del mes)
const mongoose = require('mongoose');

const spaceRecurringSchema = new mongoose.Schema({
  spaceId:     { type: String, required: true },
  id:          { type: String, required: true },
  name:        { type: String, required: true },
  type:        { type: String, enum: ['tareas', 'compra'], default: 'tareas' },
  pattern:     { type: String, required: true },
  addedBy:     { type: String, default: '' },
  lastCreated: { type: String, default: null }, // YYYY-MM-DD última instancia creada
  active:      { type: Boolean, default: true },
  ts:          { type: Date, default: Date.now }
});

spaceRecurringSchema.index({ spaceId: 1 });
spaceRecurringSchema.index({ spaceId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('SpaceRecurring', spaceRecurringSchema);
