const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Europe/Madrid';

const formatterCache = new Map();

function normalizeTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return DEFAULT_TIMEZONE;

  try {
    Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getFormatter(timeZone) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);

  if (!formatterCache.has(normalizedTimeZone)) {
    formatterCache.set(
      normalizedTimeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: normalizedTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      })
    );
  }

  return formatterCache.get(normalizedTimeZone);
}

function getTimeZoneParts(date, timeZone) {
  const parts = getFormatter(timeZone).formatToParts(date);

  return parts.reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = Number(part.value);
    return acc;
  }, {});
}

function zonedDateTimeToUtc(dateValue, timeValue = '00:00', timeZone = DEFAULT_TIMEZONE) {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);
  const [hour = 0, minute = 0] = String(timeValue || '00:00').split(':').map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = new Date(targetLocalMs);

  for (let i = 0; i < 4; i += 1) {
    const parts = getTimeZoneParts(result, normalizedTimeZone);
    const actualLocalMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second || 0
    );
    const diff = targetLocalMs - actualLocalMs;

    if (diff === 0) return result;
    result = new Date(result.getTime() + diff);
  }

  return result;
}

function ensureReminderCollection(event) {
  if (!Array.isArray(event.reminders)) event.reminders = [];

  if (event.notifyUserId) {
    const userId = String(event.notifyUserId);
    const exists = event.reminders.some(reminder => reminder.userId === userId);

    if (!exists) {
      event.reminders.push({
        userId,
        notifiedAt: event.notified ? new Date() : null
      });
    }

    event.notifyUserId = null;
    event.notified = false;
  }

  return event.reminders;
}

function hasReminderForUser(event, userId) {
  const userIdStr = String(userId);
  return ensureReminderCollection(event).some(reminder => reminder.userId === userIdStr);
}

function getReminderForUser(event, userId) {
  const userIdStr = String(userId);
  return ensureReminderCollection(event).find(reminder => reminder.userId === userIdStr) || null;
}

function setReminderForUser(event, userId, enabled) {
  const userIdStr = String(userId);
  const reminders = ensureReminderCollection(event);
  const existingIndex = reminders.findIndex(reminder => reminder.userId === userIdStr);

  if (enabled) {
    if (existingIndex === -1) {
      reminders.push({ userId: userIdStr, notifiedAt: null });
    } else {
      reminders[existingIndex].notifiedAt = null;
    }
  } else if (existingIndex !== -1) {
    reminders.splice(existingIndex, 1);
  }
}

function serializeAgendaEvent(event, userId) {
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    note: event.note,
    createdBy: event.createdBy,
    ts: event.ts,
    timeZone: normalizeTimeZone(event.timeZone),
    notifyEnabled: hasReminderForUser(event, userId)
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  ensureReminderCollection,
  getReminderForUser,
  hasReminderForUser,
  normalizeTimeZone,
  serializeAgendaEvent,
  setReminderForUser,
  zonedDateTimeToUtc
};
