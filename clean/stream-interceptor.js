const logger = require('./logger');
const { Transform } = require('node:stream');

function repairJsonArguments(argsStr) {
  if (!argsStr) return argsStr;

  let cleaned = argsStr.trim();
  const match = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (match) {
    cleaned = match[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return JSON.stringify(parsed);
  } catch (e) {
    // ignore, attempt repair
  }

  let inString = false;
  let escapeNext = false;
  let openBraces = 0;
  let closeBraces = 0;
  let openBrackets = 0;
  let closeBrackets = 0;

  const stack = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        openBraces++;
        stack.push('}');
      } else if (char === '}') {
        closeBraces++;
        if (stack[stack.length - 1] === '}') stack.pop();
      } else if (char === '[') {
        openBrackets++;
        stack.push(']');
      } else if (char === ']') {
        closeBrackets++;
        if (stack[stack.length - 1] === ']') stack.pop();
      }
    }
  }

  let patched = cleaned;
  if (inString) {
    patched += '"';
  }

  // Append missing from stack (reverses order correctly, e.g., ] then })
  // If stack logic failed due to mismatched brackets, fallback to just counting
  const bracesMissing = openBraces - closeBraces;
  const bracketsMissing = openBrackets - closeBrackets;

  if (stack.length === bracesMissing + bracketsMissing) {
    while (stack.length > 0) {
      patched += stack.pop();
    }
  } else {
    // Fallback: just append ] and } directly if stack is weird
    for (let i = 0; i < bracketsMissing; i++) {
      patched += ']';
    }
    for (let i = 0; i < bracesMissing; i++) {
      patched += '}';
    }
  }

  try {
    const parsed = JSON.parse(patched);
    return JSON.stringify(parsed);
  } catch (e) {
    throw new Error("Failed to repair JSON arguments");
  }
}

module.exports = {
  repairJsonArguments,
  createToolCallInterceptor
};

function createToolCallInterceptor() {
  let streamBuffer = '';
  let activeToolCall = null;

  function flushActiveToolCall(push, callback) {
    if (!activeToolCall) return true;

    try {
      const repairedArgs = repairJsonArguments(activeToolCall.arguments);
      
      const chunk = {
        id: activeToolCall.chunkId,
        object: 'chat.completion.chunk',
        created: activeToolCall.created || Math.floor(Date.now() / 1000),
        model: activeToolCall.model || 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: activeToolCall.index,
                  id: activeToolCall.id,
                  type: 'function',
                  function: {
                    name: activeToolCall.name,
                    arguments: repairedArgs
                  }
                }
              ]
            },
            finish_reason: null
          }
        ]
      };

      push('data: ' + JSON.stringify(chunk) + '\n\n');
      activeToolCall = null;
      return true;
    } catch (err) {
      logger.error('Failed to repair JSON arguments during flush', err);
      if (callback) callback(err);
      return false;
    }
  }

  return new Transform({
    transform(chunk, encoding, callback) {
      streamBuffer += chunk.toString('utf8');
      const lines = streamBuffer.split('\n');
      streamBuffer = lines.pop(); // Keep the last incomplete line

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line === 'data: [DONE]') {
          if (!flushActiveToolCall((data) => this.push(data), callback)) return;
          this.push(line + '\n\n');
          continue;
        }

        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          
          try {
            const data = JSON.parse(jsonStr);
            const choice = data.choices && data.choices[0];
            if (!choice) {
              this.push(line + '\n\n');
              continue;
            }

            const delta = choice.delta || {};
            const finishReason = choice.finish_reason;

            // If it has content or finish_reason = 'tool_calls', flush
            if (delta.content || finishReason === 'tool_calls' || finishReason === 'stop') {
              if (!flushActiveToolCall((data) => this.push(data), callback)) return;
              this.push(line + '\n\n');
              continue;
            }

            if (delta.tool_calls && delta.tool_calls.length > 0) {
              const tc = delta.tool_calls[0];
              
              if (activeToolCall && activeToolCall.index !== tc.index) {
                if (!flushActiveToolCall((data) => this.push(data), callback)) return;
              }

              if (!activeToolCall) {
                activeToolCall = {
                  chunkId: data.id,
                  created: data.created,
                  model: data.model,
                  index: tc.index,
                  id: tc.id || '',
                  name: (tc.function && tc.function.name) ? tc.function.name : '',
                  arguments: (tc.function && tc.function.arguments) ? tc.function.arguments : ''
                };
              } else {
                if (tc.id) activeToolCall.id = tc.id;
                if (tc.function) {
                  if (tc.function.name) activeToolCall.name += tc.function.name;
                  if (tc.function.arguments) activeToolCall.arguments += tc.function.arguments;
                }
              }
              continue; // Do NOT push this raw tool call chunk
            }

            // Other chunks, pass through
            this.push(line + '\n\n');

          } catch (e) {
            // Unparseable data line, just pass it through
            this.push(line + '\n\n');
          }
        } else {
          // Not starting with data: 
          this.push(line + '\n');
        }
      }
      callback();
    },
    flush(callback) {
      if (streamBuffer) {
        let line = streamBuffer.trim();
        if (line === 'data: [DONE]') {
          if (!flushActiveToolCall((data) => this.push(data), callback)) return;
          this.push(line + '\n\n');
        } else if (line.startsWith('data: ')) {
           if (!flushActiveToolCall((data) => this.push(data), callback)) return;
           this.push(line + '\n\n');
        } else {
          if (!flushActiveToolCall((data) => this.push(data), callback)) return;
          this.push(streamBuffer);
        }
      } else {
        if (!flushActiveToolCall((data) => this.push(data), callback)) return;
      }
      callback();
    }
  });
}
