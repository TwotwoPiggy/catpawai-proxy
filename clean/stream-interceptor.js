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

function stripJsonFence(text) {
  const trimmed = String(text || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseToolJson(text) {
  const stripped = stripJsonFence(text);
  try {
    const direct = JSON.parse(stripped);
    if (direct && typeof direct === 'object') return direct;
  } catch (_) {}
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const extracted = JSON.parse(stripped.slice(start, end + 1));
    return extracted && typeof extracted === 'object' ? extracted : null;
  } catch (_) {}
  return null;
}

function convertContentToToolCalls(content) {
  const parsed = parseToolJson(content);
  if (!parsed) return [];
  let items = [];
  if (Array.isArray(parsed)) items = parsed;
  else if (Array.isArray(parsed?.tool_calls)) items = parsed.tool_calls;
  else if (Array.isArray(parsed?.tool_uses)) items = parsed.tool_uses;
  else if (parsed?.name || parsed?.tool || parsed?.function?.name) items = [parsed];
  
  if (!items.length) return [];
  
  return items.map((call, index) => {
    const name = call.function?.name || call.name || 'tool';
    let args = call.arguments ?? call.input ?? call.parameters ?? call.function?.arguments ?? {};
    if (typeof args !== 'string') {
      args = JSON.stringify(args);
    }
    return {
      index,
      id: call.id || `call_${index}_${Date.now()}`,
      type: 'function',
      function: {
        name,
        arguments: args
      }
    };
  });
}

function createToolCallInterceptor() {
  let streamBuffer = '';
  let activeToolCall = null;

  // Variables for content interception (CatPawAI native mode)
  let contentBuffer = '';
  let isPossibleToolCall = true;
  let bufferedContentChunks = [];
  let baseChunkMeta = null;

  function flushContentBuffer(push) {
    if (!contentBuffer && bufferedContentChunks.length === 0) return;
    
    if (isPossibleToolCall && contentBuffer.trim().length > 0) {
      // Stream ended or flushed while we thought it was a tool call. Let's try to parse it.
      const repairedContent = repairJsonArguments(contentBuffer);
      const toolCalls = convertContentToToolCalls(repairedContent);
      
      if (toolCalls.length > 0) {
        // It WAS a tool call! Emit it as tool_calls chunk.
        const chunk = {
          id: baseChunkMeta?.id || `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: baseChunkMeta?.created || Math.floor(Date.now() / 1000),
          model: baseChunkMeta?.model || 'gpt-4',
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: toolCalls
              },
              finish_reason: null
            }
          ]
        };
        push('data: ' + JSON.stringify(chunk) + '\n\n');
        
        // Reset buffers
        contentBuffer = '';
        bufferedContentChunks = [];
        return;
      }
    }

    // Not a tool call, or parsing failed. Flush the original chunks.
    for (const bufferedLine of bufferedContentChunks) {
      push(bufferedLine + '\n\n');
    }
    contentBuffer = '';
    bufferedContentChunks = [];
  }

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
          flushContentBuffer((data) => this.push(data));
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
              if (!isPossibleToolCall) {
                this.push(line + '\n\n');
              } else {
                bufferedContentChunks.push(line);
              }
              continue;
            }

            const delta = choice.delta || {};
            const finishReason = choice.finish_reason;
            
            if (!baseChunkMeta) {
              baseChunkMeta = { id: data.id, created: data.created, model: data.model };
            }

            // 1. If it's a native tool_calls chunk (from OpenAI-compatible backend)
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

            // 2. If it's a content chunk, we might need to intercept it if it's a CatPawAI tool call masquerading as text
            if (delta.content !== undefined) {
              if (activeToolCall) {
                 if (!flushActiveToolCall((data) => this.push(data), callback)) return;
              }

              if (isPossibleToolCall) {
                contentBuffer += delta.content;
                bufferedContentChunks.push(line);
                
                const trimmed = contentBuffer.trimStart();
                if (trimmed.length > 0) {
                  // Valid starts for a tool call: `{`, ` ``` `, ` ```json `
                  const looksLikeTool = /^(?:```(?:json)?\s*[\r\n]*|{|$)/i.test(trimmed);
                  
                  if (!looksLikeTool) {
                    // It definitely is NOT a tool call. Flush everything and pass through from now on.
                    isPossibleToolCall = false;
                    flushContentBuffer((data) => this.push(data));
                  }
                }
                continue; // Do NOT push yet, we are either buffering or we just flushed
              } else {
                // Not a tool call, just pass through normally
                this.push(line + '\n\n');
                continue;
              }
            }

            // 3. For finish_reason or other chunks
            if (finishReason) {
              flushContentBuffer((data) => this.push(data));
              if (!flushActiveToolCall((data) => this.push(data), callback)) return;
              this.push(line + '\n\n');
              continue;
            }

            // Other chunks, pass through
            if (!isPossibleToolCall) {
              this.push(line + '\n\n');
            } else {
              bufferedContentChunks.push(line);
            }

          } catch (e) {
            // Unparseable data line, just pass it through
            if (!isPossibleToolCall) {
              this.push(line + '\n\n');
            } else {
              bufferedContentChunks.push(line);
            }
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
          flushContentBuffer((data) => this.push(data));
          if (!flushActiveToolCall((data) => this.push(data), callback)) return;
          this.push(line + '\n\n');
        } else if (line.startsWith('data: ')) {
          flushContentBuffer((data) => this.push(data));
          if (!flushActiveToolCall((data) => this.push(data), callback)) return;
          this.push(line + '\n\n');
        } else {
          flushContentBuffer((data) => this.push(data));
          if (!flushActiveToolCall((data) => this.push(data), callback)) return;
          this.push(streamBuffer);
        }
      } else {
        flushContentBuffer((data) => this.push(data));
        if (!flushActiveToolCall((data) => this.push(data), callback)) return;
      }
      callback();
    }
  });
}

