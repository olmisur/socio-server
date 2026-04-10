const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  id: String,
  name: String,
  done: { type: Boolean, default: false },
  addedBy: String,
  ts: { type: Date, default: Date.now }
});

const eventSchema = new mongoose.Schema({
  id: String,
  title: String,
  date: String,
  time: String,
  note: String,
  createdBy: String,
  notifyUserId: { type: String, default: null },
  notified: { type: Boolean, default: false },
  ts: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
  id: String,
  name: String,
  done: { type: Boolean, default: false },
  addedBy: String,
  ts: { type: Date, default: Date.now }
});

const noteSchema = new mongoose.Schema({
  id: String,
  title: String,
  body: String,
  createdBy: String,
  date: String,
  ts: { type: Date, default: Date.now }
});

const spaceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['personal', 'family', 'business'], default: 'personal' },
  inviteCode: { type: String, unique: true, sparse: true },
  members: [{
    userId: String,
    name: String,
    email: String,
    role: { type: String, enum: ['owner', 'member'], default: 'member' }
  }],
  compra: [itemSchema],
  tareas: [taskSchema],
  agenda: [eventSchema],
  notas: [noteSchema],
  updatedAt: { type: Date, default: Date.now }
});

spaceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Space', spaceSchema);
