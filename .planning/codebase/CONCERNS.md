# Concerns

**Date:** 2026-07-12

## Technical Debt & Fragile Areas
- **Tool Parsing**: The `catpawai-client.js` contains a lot of custom logic to parse JSON tool calls out of plain text (`parseToolJson`, `inferToolCallsFromText`), which can be fragile if the model output format changes unexpectedly.
- **Header Hardcoding**: Several CatPawAI specific headers (e.g., `plugin-id`, `plugin-version`, `ide-version`) read from local system files (`DEFAULT_CATPAW_PRODUCT_JSON`). This assumes a very specific local installation structure for CatPawAI on Windows.
- **Crypto Coupling**: `catpaw-crypto.js` encrypts/decrypts traffic, but the exact mechanism is tightly bound to internal logic and may break if the upstream API changes its encryption scheme.
- **Security**: The proxy must remain local (`HOST=127.0.0.1`); exposing it could leak CatPawAI tokens, which is guarded in `server.js`.
