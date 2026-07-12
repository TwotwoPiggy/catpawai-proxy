# Conventions

**Date:** 2026-07-12

## Code Style
- **JavaScript**: CommonJS module system (`require`, `module.exports`).
- **Formatting**: Vanilla Node.js without transpilations (targets Node >=18).
- **Asynchronous Code**: Uses `async/await` and Promises.

## Error Handling
- Custom `AppError` class used for application-level errors.
- `openAiError(error)` formatter function translates internal errors into standard OpenAI error shapes.
- Express error middleware in `app.js` handles unhandled exceptions and formats them for the client.

## Naming
- **Files**: kebab-case (`catpawai-client.js`, `catpaw-crypto.js`).
- **Variables/Functions**: camelCase (`createApp`, `discoverCatPawAi`, `validateChatRequest`).
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_CLI_PATH`, `DEFAULT_TIMEOUT_MS`).
