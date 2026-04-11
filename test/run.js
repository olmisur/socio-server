const assert = require('node:assert/strict');

const {
  hhmmTime,
  inviteCode,
  isoDate,
  normalizedEmail,
  optionalString,
  requiredBoolean,
  requiredString
} = require('../src/utils/requestValidation');
const {
  ensureReminderCollection,
  getReminderForUser,
  hasReminderForUser,
  serializeAgendaEvent,
  setReminderForUser,
  zonedDateTimeToUtc
} = require('../src/utils/agendaNotifications');

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run('normalizedEmail trims and lowercases values', () => {
  assert.equal(normalizedEmail('  User@Test.COM '), 'user@test.com');
});

run('normalizedEmail rejects malformed emails', () => {
  assert.throws(() => normalizedEmail('not-an-email'), /Email invalido/);
});

run('requiredString enforces min and max length', () => {
  assert.equal(requiredString(' hola ', 'Nombre invalido', { min: 2, max: 10 }), 'hola');
  assert.throws(() => requiredString(' a ', 'Nombre invalido', { min: 2, max: 10 }), /Nombre invalido/);
});

run('requiredBoolean only accepts booleans', () => {
  assert.equal(requiredBoolean(true, 'Estado invalido'), true);
  assert.throws(() => requiredBoolean('true', 'Estado invalido'), /Estado invalido/);
});

run('inviteCode uppercases and trims', () => {
  assert.equal(inviteCode(' ab12cd '), 'AB12CD');
});

run('isoDate validates YYYY-MM-DD strings', () => {
  assert.equal(isoDate('2026-04-11'), '2026-04-11');
  assert.throws(() => isoDate('11/04/2026'), /Fecha invalida/);
});

run('hhmmTime validates 24h strings and allows empty', () => {
  assert.equal(hhmmTime('06:40'), '06:40');
  assert.equal(hhmmTime(''), '');
  assert.throws(() => hhmmTime('6:40'), /Hora invalida/);
});

run('optionalString trims and accepts empty values', () => {
  assert.equal(optionalString('  nota  ', 'Nota invalida', { max: 10 }), 'nota');
  assert.equal(optionalString('', 'Nota invalida', { max: 10 }), '');
});

run('zonedDateTimeToUtc converts Madrid winter and summer offsets', () => {
  assert.equal(
    zonedDateTimeToUtc('2026-01-15', '10:00', 'Europe/Madrid').toISOString(),
    '2026-01-15T09:00:00.000Z'
  );
  assert.equal(
    zonedDateTimeToUtc('2026-07-15', '10:00', 'Europe/Madrid').toISOString(),
    '2026-07-15T08:00:00.000Z'
  );
});

run('ensureReminderCollection migrates legacy fields in-place', () => {
  const event = {
    notifyUserId: 'user-1',
    notified: true,
    reminders: []
  };

  const reminders = ensureReminderCollection(event);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].userId, 'user-1');
  assert.ok(reminders[0].notifiedAt instanceof Date);
  assert.equal(event.notifyUserId, null);
  assert.equal(event.notified, false);
});

run('setReminderForUser toggles reminders per user', () => {
  const event = { reminders: [] };

  setReminderForUser(event, 'user-1', true);
  assert.equal(hasReminderForUser(event, 'user-1'), true);

  setReminderForUser(event, 'user-1', false);
  assert.equal(hasReminderForUser(event, 'user-1'), false);
});

run('serializeAgendaEvent exposes notifyEnabled for the current user', () => {
  const event = {
    id: 'ev-1',
    title: 'Cita',
    date: '2026-04-11',
    time: '06:40',
    note: '',
    createdBy: 'Ana',
    ts: new Date('2026-04-11T00:00:00Z'),
    timeZone: 'Europe/Madrid',
    reminders: [{ userId: 'user-1', notifiedAt: null }]
  };

  assert.equal(serializeAgendaEvent(event, 'user-1').notifyEnabled, true);
  assert.equal(serializeAgendaEvent(event, 'user-2').notifyEnabled, false);
  assert.equal(getReminderForUser(event, 'user-1').userId, 'user-1');
});

console.log('All tests passed');
