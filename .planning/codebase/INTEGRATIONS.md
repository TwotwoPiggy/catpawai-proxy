# Integrations

**Date:** 2026-07-12

## External APIs
- **CatPawAI Backend API**:
  - URL Configured via `CATPAWAI_OPENAI_BASE_URL` (defaulting to https://catpaw.meituan.com/api/gpt).
  - Handles chat completions natively via `/openai/stream`.

## Authentication Providers
- **CatPawAI Authentication**:
  - Modes: `catpaw` or `bearer`.
  - Headers: `Catpaw-Auth`, `Cookie` (`1d47d6ff96_passportid`, `f32a546874_ssoid`).
  - Mis ID: `user-mis-id`, `user-uid`, `mis-id`.

## Crypto
- Traffic encryption handled via internal `catpaw-crypto.js` logic if required by environment configuration.
