# Phase 1 Context: Observability Setup & Security

**Date:** 2026-07-12
**Phase:** 1 — Observability Setup & Security
**Requirements:** OBS-01, OBS-02
**Areas Discussed:** 4

<domain>
This phase delivers structured logging, credential masking, and graceful upstream error handling for the CatPawAI proxy. It establishes the observability foundation needed before the complex tool-calling stream work in Phases 2 and 3.
</domain>

<decisions>

## Logging Library Choice
**Decision:** Enhance the existing `logger.js` — zero new dependencies.
**Rationale:** The proxy already has `logger.js` wrapping `console.log/error` with `redactString`. Adding log levels (debug/info/warn/error) and structured field support directly to this module keeps the project lightweight and avoids introducing Pino or other external logging libraries.
**Implementation guidance:** Add a `LOG_LEVEL` environment variable (default: `info`). Add `warn()` and `debug()` methods. Each method should prepend a level tag like `[catpawai-proxy] [INFO]`.

## Redaction Coverage
**Decision:** Fully cover all CatPawAI-specific sensitive fields.
**Fields to add to `redact.js`:**
- `Catpaw-Auth` header values
- `Cookie` values containing `1d47d6ff96_passportid` or `f32a546874_ssoid`
- `CATPAWAI_ACCESS_TOKEN` environment variable values
- `CATPAWAI_MIS_ID` values
**Rationale:** The existing regex in `redact.js` catches Bearer tokens and generic api_key params, but misses CatPawAI-specific authentication headers and cookies that flow through `catpawai-client.js`.

## Upstream Error Passthrough
**Decision:** Transparent passthrough — preserve upstream status codes (502/503/504) and wrap them in OpenAI error format.
**Rationale:** Clients like OpenCode need to know the specific upstream failure type to make retry decisions. A blanket 500 hides the root cause.
**Implementation guidance:** Catch `fetch` errors in `catpawai-client.js`, classify them (network timeout, HTTP error, stream interruption), and throw typed `AppError` instances with appropriate status codes. The existing Express error middleware in `app.js` (L112-115) will format them.

## Log Format & Levels
**Decision:** Human-readable format with level prefix.
**Format:** `[catpawai-proxy] [LEVEL] message`
**Levels:** debug, info, warn, error (controlled by `LOG_LEVEL` env var, default: `info`)
**Rationale:** This is a local development tool — human-readable logs are more practical than JSON for terminal output.

</decisions>

<deferred>
None — all areas were within Phase 1 scope.
</deferred>

<canonical_refs>
- `clean/logger.js` — Existing logging module to enhance
- `clean/redact.js` — Existing redaction module to extend
- `clean/errors.js` — AppError class and openAiError formatter
- `clean/app.js` — Express error middleware (L112-115)
- `clean/catpawai-client.js` — Upstream request/response handling, header construction
- `.env.example` — Environment variable template (add LOG_LEVEL)
</canonical_refs>

<code_context>
## Reusable Assets
- `logger.js` already wraps `console.log/error` with `redactString` — add level methods here
- `redact.js` has `redactString()` (regex-based) and `redactObject()` (key-based) — extend both
- `errors.js` has `AppError` class with status/code/message/type — use for upstream error classification
- Express error middleware in `app.js` L112-115 already formats errors via `openAiError()` — no changes needed there

## Patterns to Follow
- CommonJS modules (`require/module.exports`)
- kebab-case filenames
- camelCase function/variable names
- UPPER_SNAKE_CASE for constants
</code_context>
