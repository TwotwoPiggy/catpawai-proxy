# Architecture

**Date:** 2026-07-12

## System Design
The system is an Express.js-based HTTP proxy that intercepts OpenAI-compatible API requests (`/v1/chat/completions`, `/v1/models`) and translates them into CatPawAI native API requests.

## Data Flow
1. **Client Request**: A client sends an OpenAI-compatible request to the proxy server (e.g., POST `/v1/chat/completions`).
2. **Validation**: `app.js` validates the incoming JSON request (`validateChatRequest`).
3. **Upstream Request Building**: `catpawai-client.js` builds the CatPawAI specific headers and payload based on the authentication mode (`buildCatPawNativePayload`, `buildCatPawHeaders`).
4. **Encryption (Optional)**: If `shouldEncryptCatPawTraffic` is true, the request body is encrypted.
5. **Execution**: Uses `fetch` to send the payload to the CatPawAI upstream endpoint.
6. **Streaming/Response Processing**: For streaming requests, the SSE stream is piped back to the client (`createSseTransform`, `toOpenAiStreamLine`). For standard requests, the response is parsed (and decrypted if needed) and returned.

## Key Abstractions
- **catpawai-client.js**: Encapsulates all CatPawAI specific request building, header configuration, tool parsing/adaptation, and response streaming.
- **app.js**: Express routing and middleware setup.
- **server.js**: Entry point for initializing the server.
