// Notas rápidas, separadas del documento Space
const mongoose = require('mongoose');

const spaceNoteSchema = new mongoose.Schema({
  spaceId:   { type: String, required: true },
  id:        { type: String, required: true },
  title:     { type: String, default: '' },
  body:      { type: String, default: '' },
  createdBy: { type: String, default: '' },
  date:      { type: String, default: '' },
  ts:        { type: Date, default: Date.now }
});

spaceNoteSchema.index({ spaceId: 1 });
spaceNoteSchema.index({ spaceId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('SpaceNote', spaceNoteSchema);
