// Ítems de compra y tareas, separados del documento Space
const mongoose = require('mongoose');

const spaceItemSchema = new mongoose.Schema({
  spaceId: { type: String, required: true },
  type:    { type: String, enum: ['compra', 'tareas'], required: true },
  id:      { type: String, required: true },
  name:    { type: String, required: true },
  done:    { type: Boolean, default: false },
  addedBy: { type: String, default: '' },
  ts:      { type: Date, default: Date.now }
});

spaceItemSchema.index({ spaceId: 1, type: 1 });
spaceItemSchema.index({ spaceId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('SpaceItem', spaceItemSchema);
