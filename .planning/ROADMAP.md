# Roadmap

## Phase 1: Observability Setup & Security
**Objective:** Set up structured logging, handle upstream errors gracefully, and mask sensitive credentials from stdout.
**Requirements:** [OBS-01], [OBS-02]
**Success Criteria:**
- [ ] Console output does not contain raw authentication tokens or `.env` credentials.
- [ ] Application does not crash when the upstream connection drops.
- [ ] Upstream connection errors are logged with structured formats.

## Phase 2: Tool Calling Stream Processing
**Objective:** Correctly buffer streaming chunks and repair malformed JSON in tool calls.
**Requirements:** [CORE-01], [CORE-02]
**Success Criteria:**
- [ ] Streaming chunks with the same tool index are buffered and concatenated correctly.
- [ ] Malformed JSON responses from upstream are intercepted and successfully repaired into valid JSON format.
- [ ] Forwarded responses can be parsed natively by clients without JSON errors.

## Phase 3: Parallel Tool Calling Support
**Objective:** Support parsing and mapping multiple tool calls simultaneously in parallel.
**Requirements:** [CORE-03]
**Success Criteria:**
- [ ] Client receives an array containing multiple valid JSON objects when the upstream invokes multiple tools.
- [ ] Each tool call in the generated `tool_calls` array is correctly structured and mapped to its respective index.
