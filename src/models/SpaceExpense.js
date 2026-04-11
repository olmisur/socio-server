const mongoose = require('mongoose');

const spaceExpenseSchema = new mongoose.Schema({
  spaceId:     { type: String, required: true },
  id:          { type: String, required: true },
  amount:      { type: Number, required: true },
  description: { type: String, required: true },
  category:    { type: String, default: 'general' },
  addedBy:     { type: String, default: '' },
  ts:          { type: Date, default: Date.now }
});

spaceExpenseSchema.index({ spaceId: 1, ts: -1 });
spaceExpenseSchema.index({ spaceId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('SpaceExpense', spaceExpenseSchema);
