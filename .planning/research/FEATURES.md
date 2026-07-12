# Feature Research

**Domain:** AI API Proxy - Tool Calling Fix & Optimization
**Researched:** 2026-07-12
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 标准化的 `tool_calls` JSON 格式修复 | 客户端（如 OpenCode）依赖标准 OpenAI 格式的 JSON 数组结构来正确触发工具调用，格式错误会导致解析崩溃 | MEDIUM | 当前已知缺少数组边界等问题，需要在 `clean/catpawai-client.js` 进行修复 |
| 优雅的错误处理与代理透传 | 代理作为中间层，遇到上游（CatPawAI）响应异常或格式意外时不应直接崩溃，而应向客户端返回合理的错误信息 | LOW | 需要增强异常捕获机制，确保流不会意外中断 |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 并行工具调用支持 (Parallel Tool Calling) | 很多复杂任务需要一次请求调用多个工具，支持多工具并行解析可以大幅提升工作效率并满足高级客户端需求 | HIGH | 需要确保多个工具请求片段能被正确解析和拼装为合法的 JSON 数组 |
| 开发者友好的结构化日志 | 在修复和优化过程中，提供清洗前后的 Payload 对比日志，可以极大地提升调试体验 | MEDIUM | 需要注意不在日志中泄漏敏感的 Token 和鉴权信息 |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 自定义非标准工具调用协议 | 也许能更好地适配特定本地大模型的怪异格式 | 会破坏 OpenAI 兼容性，导致 OpenCode 等主流客户端无法使用 | 坚持遵循标准 OpenAI 工具调用规范，在代理层完成格式转换 |
| 代理层状态管理（记忆） | 想要在代理层自动补全上下文，减少客户端负担 | 增加了不必要的复杂性，导致难以水平扩展，且容易产生内存泄漏 | 保持代理的无状态性（Stateless），上下文仅由客户端维护和传递 |

## Feature Dependencies

```
[标准化 tool_calls JSON 格式修复]
    └──requires──> [基础本地代理与 SSE 流式输出 (Existing)]

[并行工具调用支持] ──enhances──> [标准化 tool_calls JSON 格式修复]

[开发者友好的结构化日志] ──enhances──> [优雅的错误处理与代理透传]

[代理层状态管理] ──conflicts──> [保持代理无状态的设计原则]
```

### Dependency Notes

- **[标准化 tool_calls JSON 格式修复] requires [基础本地代理与 SSE 流式输出 (Existing)]:** 工具调用的修复是建立在现有的数据流转发机制基础之上的。
- **[并行工具调用支持] enhances [标准化 tool_calls JSON 格式修复]:** 解决基本格式问题后，支持多工具并行调用进一步提高了代理的兼容性和能力。
- **[代理层状态管理] conflicts with [保持代理无状态的设计原则]:** 引入状态会导致项目失去轻量级代理的定位，违背了当前的设计目标。

## MVP Definition

### Launch With (v1.0 Tool Calling Fix & Optimization)

Minimum viable product — what's needed to validate the concept.

- [ ] **标准化 `tool_calls` JSON 格式修复** — 解决 OpenCode 等客户端因 JSON 格式不合法而解析失败的阻塞性问题。
- [ ] **并行工具调用支持 (Parallel Tool Calling)** — 确保多个并行工具调用能被正确解析和转发，满足高级客户端要求。
- [ ] **优雅的错误处理与透明日志** — 防止代理崩溃，提供有助于调试的脱敏日志。

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **特定的模型工具适配优化** — 根据实际测试中不同模型在返回 `tool_calls` 时的小差异，做针对性的兼容策略。

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **复杂的监控指标和面板** — 目前作为个人开发工具不需要复杂的监控。

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 标准化 `tool_calls` JSON 格式修复 | HIGH | MEDIUM | P1 |
| 优雅的错误处理与代理透传 | HIGH | LOW | P1 |
| 并行工具调用支持 (Parallel Tool Calling) | HIGH | HIGH | P1 |
| 开发者友好的结构化日志 | MEDIUM | LOW | P2 |
| 特定模型工具适配优化 | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | 官方 OpenAI 接口 | 其他开源 API 代理 | 本项目 (CatPawAI Proxy) |
|---------|--------------|--------------|--------------|
| 工具调用格式规范 | 完美遵守 | 可能存在兼容性问题 | **必须完美转译为标准规范** |
| 多工具并行调用 | 原生支持 | 部分支持 | **本次里程碑的核心优化目标，必须支持** |
| 调试日志可见性 | 黑盒，不可见 | 提供简单日志 | **提供本地友好的拦截与清洗日志（脱敏）** |

## Sources

- `.planning/PROJECT.md` - 项目上下文与当前里程碑目标
- OpenAI API 文档（关于 Tool Calling 的标准格式规范）
- 现有 AI 命令行客户端（如 OpenCode）的行为预期

---
*Feature research for: AI API Proxy - Tool Calling Fix & Optimization*
*Researched: 2026-07-12*
