const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function ValidationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function ensureObject(value, message = 'Peticion invalida') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw ValidationError(message);
  }

  return value;
}

function requiredString(value, message, { min = 1, max = 200, transform } = {}) {
  if (typeof value !== 'string') throw ValidationError(message);

  const nextValue = transform ? transform(value) : value.trim();
  if (nextValue.length < min || nextValue.length > max) throw ValidationError(message);

  return nextValue;
}

function optionalString(value, message, { max = 1000, transform } = {}) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw ValidationError(message);

  const nextValue = transform ? transform(value) : value.trim();
  if (nextValue.length > max) throw ValidationError(message);

  return nextValue;
}

function requiredBoolean(value, message) {
  if (typeof value !== 'boolean') throw ValidationError(message);
  return value;
}

function enumValue(value, allowed, message) {
  if (!allowed.includes(value)) throw ValidationError(message);
  return value;
}

function normalizedEmail(value, message = 'Email invalido') {
  const email = requiredString(value, message, {
    min: 5,
    max: 320,
    transform: input => input.trim().toLowerCase()
  });

  if (!EMAIL_RE.test(email)) throw ValidationError(message);
  return email;
}

function inviteCode(value, message = 'Codigo invalido') {
  return requiredString(value, message, {
    min: 6,
    max: 12,
    transform: input => input.trim().toUpperCase()
  });
}

function isoDate(value, message = 'Fecha invalida') {
  const date = requiredString(value, message, { min: 10, max: 10 });
  if (!ISO_DATE_RE.test(date)) throw ValidationError(message);

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw ValidationError(message);

  return date;
}

function hhmmTime(value, message = 'Hora invalida') {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw ValidationError(message);

  const time = value.trim();
  if (!TIME_RE.test(time)) throw ValidationError(message);

  return time;
}

function safeError(res, error, fallbackMessage = 'Error de validacion') {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(400).json({ error: fallbackMessage });
}

module.exports = {
  ValidationError,
  ensureObject,
  enumValue,
  hhmmTime,
  inviteCode,
  isoDate,
  normalizedEmail,
  optionalString,
  requiredBoolean,
  requiredString,
  safeError
};
