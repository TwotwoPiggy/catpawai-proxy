const SENSITIVE_KEY_RE = /authorization|cookie|token|access_token|api_key|catpawai_api_key|catpaw-auth/i;

function redactString(value) {
  if (typeof value !== 'string') return value;
  let result = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|authorization)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(catpaw-auth)(:\s*)([^\s\r\n,;"]+)/gi, '$1$2[REDACTED]')
    .replace(/(1d47d6ff96_passportid|f32a546874_ssoid)=([^;\s\r\n,]+)/gi, '$1=[REDACTED]');

  if (process.env.CATPAWAI_ACCESS_TOKEN) {
    result = result.split(process.env.CATPAWAI_ACCESS_TOKEN).join('[REDACTED]');
  }
  if (process.env.CATPAWAI_MIS_ID) {
    result = result.split(process.env.CATPAWAI_MIS_ID).join('[REDACTED]');
  }
  return result;
}

function redactObject(value) {
  if (typeof value === 'string') return redactString(value);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactObject);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactObject(item),
    ])
  );
}

module.exports = {
  redactObject,
  redactString,
};
