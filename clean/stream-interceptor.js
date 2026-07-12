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
  repairJsonArguments
};
