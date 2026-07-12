---
wave: 1
depends_on: []
files_modified:
  - clean/stream-interceptor.js
  - clean/app.js
autonomous: true
requirements:
  - CORE-01
  - CORE-02
---

# Phase 2: Tool Calling Stream Processing Plan

## Goals
- Buffer streaming chunks belonging to the same tool index (CORE-02).
- Intercept and automatically repair malformed JSON `tool_calls` arguments (CORE-01).

## Tasks

### Wave 1

<task>
  <read_first>
    <file>clean/logger.js</file>
  </read_first>
  <action>
    Create a new file `clean/stream-interceptor.js`.
    Export a function `repairJsonArguments(argsStr)` that:
    1. Trims the string and removes markdown JSON fences (e.g. matching `^```(?:json)?\s*([\s\S]*?)\s*```$`).
    2. Attempts to parse the string with `JSON.parse`. If successful, returns the parsed and re-stringified JSON (or just the cleaned string).
    3. If parsing fails, counts the number of `{` vs `}` and `[` vs `]`.
    4. Appends missing `]` and `}` to the end of the string to balance the brackets/braces.
    5. Attempts to parse the patched string. If successful, returns the patched string.
    6. If it still fails, throws an Error with the message "Failed to repair JSON arguments".
  </action>
  <acceptance_criteria>
    1. `clean/stream-interceptor.js` exists and exports `repairJsonArguments`.
    2. `node -e "const { repairJsonArguments } = require('./clean/stream-interceptor'); console.log(repairJsonArguments('{\"a\":1'));"` outputs a balanced JSON string.
    3. Passing completely invalid/unrepairable JSON throws an Error.
  </acceptance_criteria>
</task>

<task>
  <read_first>
    <file>clean/stream-interceptor.js</file>
    <file>clean/logger.js</file>
  </read_first>
  <action>
    In `clean/stream-interceptor.js`, import `Transform` from `node:stream` and `logger` from `./logger.js`.
    Implement and export `createToolCallInterceptor()`, which returns a new `Transform` stream.
    Inside the transform stream state, maintain `streamBuffer` (for partial chunks) and `activeToolCall` (for buffering the current tool call).
    The transform must intercept SSE lines starting with `data: `:
    1. Split incoming chunks by newline to process complete SSE lines. Keep the last incomplete line in `streamBuffer`.
    2. For `data: [DONE]`, flush any `activeToolCall` as a valid tool_calls chunk before emitting `data: [DONE]\n\n`.
    3. For normal JSON payload chunks, check for `choices[0].delta.tool_calls`.
    4. If a tool_call chunk is found, take the first tool call in the array. If `activeToolCall` exists but has a different `index`, flush it first. Then update `activeToolCall` (buffering `chunkId`, `index`, `id`, and concatenating `function.name` and `function.arguments`). Do NOT push this raw tool call chunk to the output stream.
    5. If a chunk with `choices[0].finish_reason` equal to `'tool_calls'` or a regular `content` chunk arrives, flush the buffered `activeToolCall` before pushing the current line.
    6. To flush: call `repairJsonArguments` on the buffered arguments. If it throws, catch it, log via `logger.error`, and call the Transform stream `callback(err)` to abort the stream. If it succeeds, emit the complete tool call as an exact SSE line: `data: {"id":"...","object":"chat.completion.chunk","created":...,"model":"...","choices":[{"index":0,"delta":{"tool_calls":[{"index":...,"id":"...","type":"function","function":{"name":"...","arguments":"..."}}]},"finish_reason":null}]}\n\n`.
  </action>
  <acceptance_criteria>
    1. `createToolCallInterceptor` is exported from `clean/stream-interceptor.js`.
    2. The transform correctly buffers consecutive `tool_calls` chunks with the same index and emits a single, concatenated chunk upon flush.
    3. The transform gracefully catches `repairJsonArguments` errors and calls the stream callback with the error.
  </acceptance_criteria>
</task>

<task>
  <read_first>
    <file>clean/app.js</file>
    <file>clean/stream-interceptor.js</file>
  </read_first>
  <action>
    Modify `clean/app.js` to use `createToolCallInterceptor`.
    In the `POST /v1/chat/completions` route, inside the `if (request.stream && catpawaiClient.createChatCompletionStream)` block:
    1. Require `createToolCallInterceptor` from `./stream-interceptor.js`.
    2. After creating `nodeStream` from `upstream.body`, instantiate `const interceptor = createToolCallInterceptor()`.
    3. Add an `'error'` event listener to `interceptor` that logs the error via `logger.error` and calls `res.destroy(err)` (similar to `nodeStream`'s error listener).
    4. Change the piping chain from `nodeStream.pipe(res)` to `nodeStream.pipe(interceptor).pipe(res)`.
  </action>
  <acceptance_criteria>
    1. `clean/app.js` imports `createToolCallInterceptor`.
    2. The `/v1/chat/completions` stream route pipes `nodeStream` through `interceptor` before piping to `res`.
    3. An error listener on `interceptor` handles errors by logging and destroying the response stream.
  </acceptance_criteria>
</task>

## Verification
- Test sending an SSE stream with broken JSON `arguments` inside `tool_calls` delta to the proxy.
- Ensure the client receives a single `tool_calls` chunk with perfectly repaired JSON.

### must_haves
- [ ] `clean/stream-interceptor.js` correctly patches missing brackets in tool call JSON strings. (D-02)
- [ ] `createToolCallInterceptor` suppresses intermediate `tool_calls` chunks and emits only one completed, repaired tool chunk per tool index. (D-01, D-03)
- [ ] `clean/app.js` integrates the interceptor into the SSE pipeline seamlessly.

## Artifacts this phase produces
- **New File**: `clean/stream-interceptor.js`
- **Functions**: `repairJsonArguments`, `createToolCallInterceptor`

## PLANNING COMPLETE
