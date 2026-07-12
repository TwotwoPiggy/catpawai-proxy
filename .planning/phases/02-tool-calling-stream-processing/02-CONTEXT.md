# Phase 2: Tool Calling Stream Processing - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Correctly buffer streaming chunks and repair malformed JSON in tool calls. Only parse/reconstruct tool calls in the SSE stream before forwarding to the client.

</domain>

<decisions>
## Implementation Decisions

### Stream interception strategy
- **D-01:** Intercept only SSE chunks containing 'tool_calls', let text/content chunks pass through immediately to keep normal streaming fast.

### JSON Repair approach
- **D-02:** Use native string manipulation and JSON.parse/stringify to reconstruct the array properly (keeps zero-dependency rule from Phase 1).

### Latency vs Safety for tool calls
- **D-03:** Buffer all 'tool_calls' chunks belonging to the same tool index. When it finishes, emit it as one valid chunk (Safest, client receives one valid chunk per tool).

### the agent's Discretion
None

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `.planning/PROJECT.md` — Project definition and environment constraints.
- `clean/app.js` — Target for SSE interception.
- `clean/catpawai-client.js` — Target for JSON response repair if modifying standard responses.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `clean/logger.js`: Use the structured logger from Phase 1 to log stream chunks buffering and repair successes/failures.
- `clean/app.js`: Use the SSE proxy pipeline established to intercept data chunks before they are sent to `res.write()`.

### Established Patterns
- Zero dependency approach: No external parsing libraries.
- Error Handling: We map errors to 500/502 using custom logic; stream errors emit `res.destroy(err)`.

### Integration Points
- Intercept the `data:` lines in the chunk event listener inside `clean/app.js` proxy route, decode, modify if necessary, and re-encode to stream.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2-tool-calling-stream-processing*
*Context gathered: 2026-07-12*
