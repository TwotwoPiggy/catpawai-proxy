const test = require('node:test');
const assert = require('node:assert/strict');
const logger = require('../clean/logger');

function captureConsole(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalDebug = console.debug;

  const logs = [];
  const errors = [];
  const warns = [];
  const debugs = [];

  console.log = (msg) => logs.push(msg);
  console.error = (msg) => errors.push(msg);
  console.warn = (msg) => warns.push(msg);
  console.debug = (msg) => debugs.push(msg);

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.debug = originalDebug;
  }

  return { logs, errors, warns, debugs };
}

test('filters output according to process.env.LOG_LEVEL', () => {
  const oldLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'warn';

  try {
    const outputs = captureConsole(() => {
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
    });

    assert.equal(outputs.debugs.length, 0);
    assert.equal(outputs.logs.length, 0);
    assert.equal(outputs.warns.length, 1);
    assert.equal(outputs.errors.length, 1);
    assert.ok(outputs.warns[0].includes('[catpawai-proxy] [WARN] warn message'));
    assert.ok(outputs.errors[0].includes('[catpawai-proxy] [ERROR] error message'));
  } finally {
    process.env.LOG_LEVEL = oldLevel;
  }
});

test('prefixes logs with [catpawai-proxy] [LEVEL]', () => {
  const oldLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';

  try {
    const outputs = captureConsole(() => {
      logger.debug('hello');
      logger.info('world');
    });

    assert.equal(outputs.debugs[0], '[catpawai-proxy] [DEBUG] hello');
    assert.equal(outputs.logs[0], '[catpawai-proxy] [INFO] world');
  } finally {
    process.env.LOG_LEVEL = oldLevel;
  }
});

test('redacts sensitive content inside meta object', () => {
  const oldLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';

  try {
    const outputs = captureConsole(() => {
      logger.info('Request made', { Authorization: 'Bearer token123', safe: true });
    });

    assert.equal(outputs.logs.length, 1);
    const logVal = outputs.logs[0];
    assert.ok(logVal.includes('[catpawai-proxy] [INFO] Request made'));
    assert.ok(logVal.includes('[REDACTED]'));
    assert.ok(!logVal.includes('Bearer token123'));
    assert.ok(logVal.includes('"safe":true'));
  } finally {
    process.env.LOG_LEVEL = oldLevel;
  }
});

test('redacts plain sensitive value in metadata string', () => {
  const oldLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';

  try {
    const outputs = captureConsole(() => {
      logger.info('Auth failed with header', 'Catpaw-Auth: raw-secret-key');
    });

    assert.equal(outputs.logs.length, 1);
    const logVal = outputs.logs[0];
    assert.ok(logVal.includes('Catpaw-Auth: [REDACTED]'));
    assert.ok(!logVal.includes('raw-secret-key'));
  } finally {
    process.env.LOG_LEVEL = oldLevel;
  }
});

test('formats and prints stack trace for Error objects in meta', () => {
  const oldLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'error';

  try {
    const err = new Error('Database connection failed');
    const outputs = captureConsole(() => {
      logger.error('Database error occurred', err);
    });

    assert.equal(outputs.errors.length, 1);
    const logVal = outputs.errors[0];
    assert.ok(logVal.includes('[catpawai-proxy] [ERROR] Database error occurred'));
    assert.ok(logVal.includes('Database connection failed'));
    assert.ok(logVal.includes('Error: Database connection failed'));
    assert.ok(logVal.includes('logger.test.js'));
  } finally {
    process.env.LOG_LEVEL = oldLevel;
  }
});
