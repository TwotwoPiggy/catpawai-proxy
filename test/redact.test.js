const test = require('node:test');
const assert = require('node:assert/strict');
const { redactObject, redactString } = require('../clean/redact');

test('redacts bearer tokens in strings', () => {
  assert.equal(redactString('Authorization: Bearer abc.def'), 'Authorization: Bearer [REDACTED]');
});

test('redacts sensitive object keys', () => {
  assert.deepEqual(redactObject({ CATPAWAI_API_KEY: 'secret', ok: 'yes' }), {
    CATPAWAI_API_KEY: '[REDACTED]',
    ok: 'yes',
  });
});

test('redacts Catpaw-Auth headers in strings', () => {
  assert.equal(redactString('Catpaw-Auth: token123'), 'Catpaw-Auth: [REDACTED]');
});

test('redacts passportid and ssoid in cookies', () => {
  assert.equal(
    redactString('Cookie: 1d47d6ff96_passportid=abc; f32a546874_ssoid=def'),
    'Cookie: 1d47d6ff96_passportid=[REDACTED]; f32a546874_ssoid=[REDACTED]'
  );
});

test('redacts process.env.CATPAWAI_ACCESS_TOKEN if configured', () => {
  const oldToken = process.env.CATPAWAI_ACCESS_TOKEN;
  process.env.CATPAWAI_ACCESS_TOKEN = 'mock-access-token';
  try {
    const res = redactString('The local token mock-access-token is configured');
    assert.ok(res.includes('[REDACTED]'));
    assert.ok(!res.includes('mock-access-token'));
  } finally {
    process.env.CATPAWAI_ACCESS_TOKEN = oldToken;
  }
});

test('redacts process.env.CATPAWAI_MIS_ID if configured', () => {
  const oldMisId = process.env.CATPAWAI_MIS_ID;
  process.env.CATPAWAI_MIS_ID = 'mis-999';
  try {
    const res = redactString('MIS is mis-999');
    assert.ok(res.includes('[REDACTED]'));
    assert.ok(!res.includes('mis-999'));
  } finally {
    process.env.CATPAWAI_MIS_ID = oldMisId;
  }
});

test('redacts string values inside object recursively even if keys are not sensitive', () => {
  const oldToken = process.env.CATPAWAI_ACCESS_TOKEN;
  process.env.CATPAWAI_ACCESS_TOKEN = 'mock-access-token';
  try {
    const input = {
      nested: {
        someKey: 'The local token mock-access-token is configured',
      },
    };
    const expected = {
      nested: {
        someKey: 'The local token [REDACTED] is configured',
      },
    };
    assert.deepEqual(redactObject(input), expected);
  } finally {
    process.env.CATPAWAI_ACCESS_TOKEN = oldToken;
  }
});
