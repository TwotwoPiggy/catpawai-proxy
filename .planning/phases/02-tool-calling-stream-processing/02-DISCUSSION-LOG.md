# Phase 2: Tool Calling Stream Processing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 2-Tool Calling Stream Processing
**Areas discussed:** Stream interception strategy, JSON Repair approach, Latency vs Safety for tool calls

---

## Stream interception strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | (Recommended) Intercept only SSE chunks containing 'tool_calls', let text/content chunks pass through immediately to keep normal streaming fast. | ✓ |
| 2 | Buffer ALL chunks until the stream is complete, and process everything at the end. (Breaks streaming UX) | |

**User's choice:** Intercept only SSE chunks containing 'tool_calls', let text/content chunks pass through immediately to keep normal streaming fast.
**Notes:** 

---

## JSON Repair approach

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | (Recommended) Use native string manipulation and JSON.parse/stringify to reconstruct the array properly (keeps zero-dependency rule). | ✓ |
| 2 | Add a lightweight JSON repairing library to be safer. | |

**User's choice:** Use native string manipulation and JSON.parse/stringify to reconstruct the array properly (keeps zero-dependency rule).
**Notes:** 

---

## Latency vs Safety for tool calls

| Option | Description | Selected |
|--------|-------------|----------|
| 1 | (Recommended) Buffer all 'tool_calls' chunks belonging to the same tool. When it finishes, emit it as one valid chunk (Safest, client receives one valid chunk per tool). | ✓ |
| 2 | Try to emit valid partial JSON strings dynamically as they arrive (Very complex and error-prone). | |

**User's choice:** Buffer all 'tool_calls' chunks belonging to the same tool. When it finishes, emit it as one valid chunk (Safest, client receives one valid chunk per tool).
**Notes:** 

---

## the agent's Discretion
None

## Deferred Ideas
None
