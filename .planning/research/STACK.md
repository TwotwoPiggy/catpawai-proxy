# Stack Research

**Domain:** Local API Proxy (Tool Calling & Streaming)
**Researched:** 2026-07-12
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `jsonrepair` | `^3.15.0` | 修复大模型生成的非法或不完整的 JSON 工具调用响应 | LLM 常常在返回多个并行工具调用时输出格式错误的 JSON（例如：缺失数组括号、截断的字符串等）。`jsonrepair` 能够鲁棒地自动修复这些问题，而无需手动编写脆弱的正则过滤。 |
| `eventsource-parser` | `^3.1.0` | 健壮地解析上游 SSE (Server-Sent Events) 数据流 | 目前项目 `catpawai-client.js` 中的 `createSseTransform` 使用手写字符串分割 `\n` 来解析流，这种方式在处理复杂的数据块时容易出错断链。此库为流式处理提供了经过充分测试的标准解析方式。 |
| `pino` | `^10.3.0` | 提供结构化的错误处理机制和日志输出 | 极轻量且高性能的 JSON 日志库，非常适合代理场景，有助于更好地跟踪请求链路和诊断上游 CatPawAI 的异常。 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pino-pretty` | `^13.1.0` | 在开发环境中格式化 `pino` 输出 | 仅在开发时使用，用于将结构化的 JSON 日志格式化为人类可读、带颜色的控制台输出。 |
| `partial-json` | `^0.1.7` | 实时解析非完整的 JSON 数据 | 如果客户端（如 OpenCode）需要在流式输出中逐字接收并渲染工具调用的参数 `arguments` 时使用。 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` | 内置测试运行器 | 项目已在使用。对于此量级的本地代理，保持原生内置测试足矣，不需要引入 Jest 或 Mocha 等重型工具。 |

## Installation

```bash
# Core
npm install jsonrepair eventsource-parser pino

# Supporting
npm install partial-json

# Dev dependencies
npm install -D pino-pretty
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `jsonrepair` | `secure-json-parse` | 如果系统对原型链污染的安全防御优先级极高，且不要求容错修复破损的 JSON 语法。 |
| `pino` | `winston` | 仅当代理服务需要复杂的日志轮转配置、多种自定义传输介质 (Transports) 或更重型的日志生态时。 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| 笨重的 LLM SDK (如 `langchain`, `LlamaIndex`) | 对于一个单纯的本地 HTTP 转换代理来说，引入它们过于庞大，不仅增加体积，还会增加上游映射和处理负担。 | 原生 `fetch` 结合简单的 JSON 数据处理逻辑。 |
| `openai` (Node.js SDK 官方库) | 官方库主要是作为客户端来请求 OpenAI API 的，而不是用来在代理端提供服务端点映射和生成的。 | 标准的 `express` 路由和控制器处理。 |
| 复杂的校验库 (如 `zod`, `ajv`) | 增加不必要的打包体积。当前项目只是充当代理管道，不对工具调用的 Schema 做严苛校验，保持原样传递并修复格式更合理。 | 原生 `JSON.parse` 搭配 `jsonrepair`。 |

## Stack Patterns by Variant

**如果客户端强制要求支持逐字的工具调用流式参数解析：**
- 结合使用 `partial-json` 和流式重写器
- 因为客户端（如 OpenCode）可能依赖 `delta.tool_calls[0].function.arguments` 的流式增量接收来做实时渲染或中断处理。

**如果代理只关心确保 JSON 格式合法并能够一次性返回修正结果：**
- 在上游返回整个流块后或非流式模式下，直接在末端使用 `jsonrepair` 处理 `content`。
- 因为这更为简单，并且避免了在每个微小的 stream chunk 上解析破损 JSON 带来的性能开销。

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `eventsource-parser@^3.1.0` | Node.js `>=18.0.0` | 依赖并充分利用了 Node 18 内置的 Web Streams API 和 Fetch API，完美兼容本项目的运行环境要求。 |

## Sources

- NPM Registry — 查询确认了 `jsonrepair`, `eventsource-parser`, `pino` 的当前最新稳定主版本及其适用性。
- Codebase Context — 分析了 `clean/catpawai-client.js` 中现有的手写 SSE 解析（依赖简单的换行分割）和针对 JSON 的手动截取解析。
- Project Requirements (`PROJECT.md`) — 严格对应目标特性需求：“修复 tool_calls 的无效 JSON 格式” 对应 `jsonrepair`，“完善对并行工具调用的兼容性” 需要增强流解析逻辑，“优化错误处理机制和日志输出格式” 对应 `pino` 库。

---
*Stack research for: Tool Calling Fix & Optimization*
*Researched: 2026-07-12*
