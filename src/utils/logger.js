// Logger estructurado: emite JSON con timestamp, nivel y contexto
// En tests (NODE_ENV=test) suprime la salida para no ensuciar el output
const isSilent = process.env.NODE_ENV === 'test';

function write(level, message, meta = {}) {
  if (isSilent) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta
  };
  if (level === 'error') {
    process.stderr.write(JSON.stringify(entry) + '\n');
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

const logger = {
  info:  (msg, meta)  => write('info',  msg, meta),
  warn:  (msg, meta)  => write('warn',  msg, meta),
  error: (msg, meta)  => write('error', msg, meta),
  debug: (msg, meta)  => write('debug', msg, meta),
};

module.exports = logger;
