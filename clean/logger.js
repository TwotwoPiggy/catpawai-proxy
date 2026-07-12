const { redactString, redactObject } = require('./redact');
const { EventEmitter } = require('node:events');

const logEmitter = new EventEmitter();

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getActiveLogLevel() {
  const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.info;
}

function shouldLog(levelName) {
  const current = getActiveLogLevel();
  const levelVal = LOG_LEVELS[levelName];
  return levelVal >= current;
}

function formatMeta(meta) {
  if (meta === undefined) {
    return '';
  }
  if (meta instanceof Error) {
    return '\n' + (meta.stack || meta.message);
  }
  if (meta !== null && typeof meta === 'object') {
    return ' ' + JSON.stringify(redactObject(meta));
  }
  return ' ' + redactString(String(meta));
}

function print(levelName, message, meta) {
  if (!shouldLog(levelName)) {
    return;
  }

  const levelTag = levelName.toUpperCase();
  const metaStr = formatMeta(meta);
  const rawLine = `[catpawai-proxy] [${levelTag}] ${message}${metaStr}`;
  const redactedLine = redactString(rawLine);

  if (levelName === 'error') {
    console.error(redactedLine);
  } else if (levelName === 'warn') {
    console.warn(redactedLine);
  } else if (levelName === 'debug') {
    console.debug(redactedLine);
  } else {
    console.log(redactedLine);
  }

  logEmitter.emit('log', { level: levelName, message: redactedLine, timestamp: new Date().toISOString() });
}

function debug(message, meta) {
  print('debug', message, meta);
}

function info(message, meta) {
  print('info', message, meta);
}

function warn(message, meta) {
  print('warn', message, meta);
}

function error(message, meta) {
  print('error', message, meta);
}

function log(message, meta) {
  info(message, meta);
}

module.exports = {
  debug,
  info,
  warn,
  error,
  log,
  logEmitter,
};
