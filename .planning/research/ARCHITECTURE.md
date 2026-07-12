# Architecture Research

**Domain:** Local Express.js API Proxy (OpenAI ↔ CatPawAI)
**Researched:** 2026-07-12
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Express.js Proxy                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ app.js      │  │ logger.js    │  │ errors.js         │    │
│  │ (Routes)    │  │ (Logging)    │  │ (Error Handling)  │    │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘    │
│         │                │                   │               │
├─────────┴────────────────┴───────────────────┴───────────────┤
│                    catpawai-client.js                        │
│                  (OpenAI ↔ CatPawAI)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Payload      │  │ Tool JSON    │  │ Tool Calls        │   │
│  │ Builder      │  │ Parser &     │  │ Adapter           │   │
│  │              │  │ Repair (NEW) │  │                   │   │
│  └──────────────┘  └──────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `app.js` | Receives OpenAI requests and routes to the adapter. | Express router with validation middleware. |
| `logger.js` (Modified)| Redacts sensitive tokens and logs request lifecycle. | Standard `console.log` wrapped with regex redaction. |
| `errors.js` (Modified)| Standardizes error structures for the proxy. | Custom `AppError` class. |
| `catpawai-client.js` | Core adapter logic mapping schemas between interfaces. | Functions constructing headers/payloads. |
| Tool JSON Parser (New) | Intercepts malformed stringified JSON and repairs it. | Regex and tolerant JSON parsing. |

## Recommended Project Structure

```
clean/
├── app.js               # Express API endpoints & logging integration
├── logger.js            # Redaction-aware logger
├── errors.js            # Unified error formatting
├── catpawai-client.js   # Main translation layer (adds JSON repair logic)
└── catpaw-crypto.js     # Existent crypto layer
```

### Structure Rationale

- **`clean/`:** Contains the primary proxy scripts. The new functionality will purely modify existing scripts instead of creating new structural layers to keep the proxy lightweight.

## Architectural Patterns

### Pattern 1: Tolerant Reader (JSON Repair)

**What:** When dealing with unreliable upstream AI generators that emit broken JSON like `{"tool_calls": {...}, {...}}`, we intercept the string, apply heuristics (like wrapping with `[` `]`), and parse.
**When to use:** When the upstream service is out of your control and frequently returns malformed formatting.
**Trade-offs:** Can introduce false positives if the regex/heuristic is too aggressive, potentially corrupting valid responses.

**Example:**
```javascript
function repairAndParseToolJson(text) {
  let jsonString = stripJsonFence(text);
  // Example heuristic: wrap un-bracketed comma-separated objects
  if (jsonString.match(/^\s*\{.*\},\s*\{.*\}\s*$/)) {
     jsonString = `[${jsonString}]`;
  }
  return parseJsonText(jsonString);
}
```

### Pattern 2: Intercepting Adapter

**What:** Standardizing an external non-compliant API to look exactly like the OpenAI API, down to the error format and streaming chunks.
**When to use:** When downstream clients (like OpenCode) strictly enforce OpenAI schema.

## Data Flow

### Request Flow

```
[OpenCode Client]
    ↓ (Standard OpenAI Request)
[app.js] → Logs Request via logger.js (NEW)
    ↓
[catpawai-client.js] → Builds Upstream Payload
    ↓
[CatPawAI Model]
    ↓ (Returns malformed JSON string)
[catpawai-client.js] → repairAndParseToolJson() (NEW)
    ↓ (Extracts valid Tool Call Objects)
[catpawai-client.js] → adaptCompletionToolCalls()
    ↓ (Returns compliant choices array)
[app.js] → Logs Response / Error via logger.js (NEW)
    ↓ 
[OpenCode Client]
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Local user | Current architecture is perfectly adequate. Memory bloat during large context responses is the primary bottleneck. |

### Scaling Priorities

1. **First bottleneck:** Large parallel tool calls could overwhelm the JSON parsing logic or regex heuristics. The parser should be optimized to not run catastrophic backtracking regexes.

## Anti-Patterns

### Anti-Pattern 1: Strict JSON parsing on AI responses

**What people do:** Relying entirely on `JSON.parse` for AI tool outputs.
**Why it's wrong:** LLMs frequently omit trailing brackets, commas, or output raw objects instead of arrays.
**Do this instead:** Apply tolerant repair steps before attempting parsing.

### Anti-Pattern 2: Silently swallowing API errors

**What people do:** Catching errors from CatPawAI and returning generic 500s.
**Why it's wrong:** The developer (or OpenCode) gets no actionable feedback when authentication or generation fails.
**Do this instead:** Use `logger.error` to dump redacted stack traces, and map CatPawAI errors directly to `openAiError` structures.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app.js` ↔ `logger.js` | Direct calls | Ensure `logger.js` is imported and used in the request lifecycle and global error handler in `app.js`. |
| `catpawai-client.js` ↔ Parsing | Synchronous processing | Replace `parseToolJson` with a robust implementation that identifies multiple parallel tool structures and repairs missing array brackets. |
| `catpawai-client.js` ↔ Streaming | Text Transformation | Ensure any JSON repair logic gracefully handles tool calls during streaming if they are embedded in the content chunks. |

## Build Order (Considering Dependencies)

1. **Phase 1: Observability & Errors**
   - Import `logger.js` in `app.js`.
   - Add request/response/error logging to endpoints.
   - Refactor `errors.js` if necessary to capture upstream status codes.
2. **Phase 2: JSON Repair Core**
   - In `catpawai-client.js`, refactor `parseToolJson` to detect and repair the `{"tool_calls": {...}, {...}}` anomaly and wrap elements in JSON arrays.
3. **Phase 3: Parallel Tool Compatibility**
   - Ensure `convertTextToToolCalls` maps the repaired JSON array properly into individual OpenAI-compliant tool calls with unique IDs.
4. **Phase 4: Testing**
   - Validate using `npm test` and mock malformed upstream responses.

---
*Architecture research for: Tool Calling Fix & Optimization*
*Researched: 2026-07-12*
