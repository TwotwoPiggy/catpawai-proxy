# Tech Stack

**Date:** 2026-07-12

## Core Technologies
- **Language**: JavaScript (Node.js >=18.0.0)
- **Runtime**: Node.js
- **Framework**: Express.js (HTTP server framework)
- **Package Manager**: npm

## Dependencies
- `express` (^4.18.2): Web server framework.
- `cors` (^2.8.5): Cross-Origin Resource Sharing middleware.
- `dotenv` (^16.3.1): Environment variable loading.

## Configuration
- `.env` used for environment configuration (e.g., `HOST`, `PORT`, `CATPAWAI_OPENAI_BASE_URL`, `CATPAWAI_AUTH_MODE`, `CATPAWAI_ACCESS_TOKEN`, etc.).
- `package.json` contains startup and diagnostic scripts (`start`, `dev`, `test`, `diagnose`, `configure-auth`, `configure-from-catpaw-config`, `import-from-catpaw-state`, `smoke`).
