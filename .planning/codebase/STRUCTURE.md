# Directory Structure

**Date:** 2026-07-12

## Layout
- `/` - Root directory containing config files, scripts, and documentation.
- `/clean/` - Core source code for the proxy server.
- `/scripts/` - Utility scripts for configuration and diagnostics (PowerShell, Python, Node.js).
- `/test/` - Contains test files (indicated by the `node --test` command in `package.json`).

## Key Files
- `package.json` - Dependencies and NPM scripts.
- `.env.example` - Template for environment variables.
- `clean/server.js` - Main entry point that binds the Express app to the configured host/port.
- `clean/app.js` - Express application definition, routing, and endpoint handlers (`/v1/chat/completions`, `/health`, `/diagnostics`).
- `clean/catpawai-client.js` - CatPawAI client module containing the core logic for communicating with the CatPawAI backend.
- `clean/catpaw-crypto.js` - Cryptography logic for encrypting/decrypting traffic.
- `clean/models.js` - Model definitions and resolution logic.
- `clean/errors.js` - Custom error classes and error formatting (`AppError`, `openAiError`).
- `clean/logger.js` - Basic logging utility.
- `clean/redact.js` - Utility for redacting sensitive information (likely from logs).
