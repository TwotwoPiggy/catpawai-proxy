# Project Research Summary

**Project:** CatPawAI Proxy
**Domain:** AI API Proxy - Tool Calling Fix & Optimization
**Researched:** 2026-07-12
**Confidence:** HIGH

## Executive Summary

本项目是一个基于 Node.js/Express 的本地 API 代理，主要用于将外部非标准或经常返回损坏工具调用格式的大模型（CatPawAI）转译为严格符合 OpenAI 规范的接口。
核心目标是修复工具调用（Tool Calling）中常见的 JSON 格式破损问题，并支持多工具并行调用，以满足主流 AI 客户端（如 OpenCode）的严苛要求。

在技术路线上，建议采用“容错解析”模式，引入 `jsonrepair` 进行破损 JSON 的自动修复，通过完善的内存状态机进行 SSE 流数据拼接。主要风险在于流式分块解析不当导致的并行工具聚合错乱，以及错误处理时可能泄露的个人 token 等敏感信息。

## Key Findings

### Recommended Stack

建议使用轻量且容错性高的库来处理 JSON 修复和流式处理。

**Core technologies:**
- `jsonrepair`: 修复大模型生成的非法或不完整的 JSON 工具调用响应 — 能够鲁棒地自动修复破损 JSON，无需脆弱的正则过滤。
- `eventsource-parser`: 健壮地解析上游 SSE 数据流 — 替代脆弱的手写换行分割，提供可靠的流块解析。
- `pino`: 提供结构化的错误处理机制和日志输出 — 轻量且高效的日志库，便于调试且可通过拦截脱敏。

### Expected Features

本代理的核心特性聚焦于格式的严格转换和流式数据的稳定性。

**Must have (table stakes):**
- 标准化的 `tool_calls` JSON 格式修复 — 解决客户端因 JSON 格式不合法而解析失败的阻塞性问题
- 并行工具调用支持 (Parallel Tool Calling) — 确保多个并行工具调用能被正确解析和转发
- 优雅的错误处理与代理透传 — 防止代理崩溃，处理上游连接异常

**Should have (competitive):**
- 开发者友好的结构化日志 — 提供清洗前后的 Payload 对比日志，提升调试体验
- 特定模型工具适配优化 — 针对不同模型在返回 `tool_calls` 时的微小差异做针对性兼容

**Defer (v2+):**
- 复杂的监控指标和面板 — 目前作为个人开发工具不需要

### Architecture Approach

采用基于 Express.js 的轻量级拦截与转换架构。在保留当前主路由的基础上，将核心修复逻辑注入到现有的适配层 `catpawai-client.js`。

**Major components:**
1. `app.js` — 接收客户端请求，负责路由转发，并集成全局错误与日志处理中间件。
2. `catpawai-client.js` — 核心转译适配层，拦截上游返回的数据流，通过“容错 JSON 解析器”和流状态机进行修复与封装。
3. `logger.js` (新增/强化) — 脱敏日志层，拦截所有输出防止凭据泄露。

### Critical Pitfalls

流数据处理和本地开发中的日志记录是最容易出现问题的环节。

1. **忽略 SSE 流中的工具调用块拼接导致解析失败** — 引入状态机或缓冲对象，在内存中持续拼接属于同一个工具调用的 `arguments`，直到流结束再解析。
2. **多并行工具调用索引错乱** — 在内存中维护映射字典，以 `index` 为键聚合参数片段，最终输出时再转换为标准的 JSON 数组格式。
3. **在日志记录中泄漏敏感凭证** — 实现统一的日志过滤器，在打印前剔除或掩码 `Authorization` 及本地 token 环境变量，避免凭据落盘。

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Observability & Errors (可观测性与脱敏日志)
**Rationale:** 调试基础。在进行复杂的流解析开发前，必须确保错误可见且日志安全。
**Delivers:** 引入 `pino` 日志系统和重构统一的错误捕获层。
**Addresses:** 优雅的错误处理与代理透传、开发者友好的结构化日志。
**Avoids:** 在日志记录中泄漏敏感凭证、阻塞或吞噬上游服务错误。

### Phase 2: JSON Repair Core (标准化格式修复)
**Rationale:** 核心价值。解决现有工具调用频繁因少括号、缺数组包裹等格式问题导致下游客户端崩溃的痛点。
**Delivers:** 在 `catpawai-client.js` 中引入 `jsonrepair` 进行容错解析修复。
**Uses:** `jsonrepair`
**Implements:** Tool JSON Parser (容错读取器)。

### Phase 3: Parallel Tool Compatibility (并行工具流式聚合)
**Rationale:** 高级特性依赖于基础修复。静态修复跑通后，引入 SSE 状态机来解决并行多工具调用的截断和聚合问题。
**Delivers:** 替换原有的正则/字符串流解析逻辑，引入安全的按 `index` 聚合的状态机。
**Uses:** `eventsource-parser`, 状态机缓冲区。
**Implements:** Intercepting Adapter 的流合并转换逻辑。

### Phase Ordering Rationale

- **风险隔离驱动：** 优先搭建脱敏日志（Phase 1），保证后续复杂调试时即使抛错也不会发生凭证外泄；然后攻克单工具的 JSON 修复（Phase 2），解决目前的阻塞性 bug；最后处理最复杂的并行工具流聚合（Phase 3）。
- **迭代递进：** 从代理的外围基础（可观测性）到底层核心（静态 JSON 修复），再到高级流式处理，依赖关系清晰且每一步均可独立测试。

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** 并行工具流式聚合 — 内存状态机的管理需要细致设计。可能涉及与 OpenCode 接收数据边界的严格联调，需要确认下游到底需要多细粒度的增量输出。

Phases with standard patterns (skip research-phase):
- **Phase 1 & 2:** 错误处理脱敏和静态 JSON 修复有明确的业界标准（引入成熟组件如 `pino` 和 `jsonrepair`），模式成熟，可直接进入设计与实施。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 所选依赖如 `jsonrepair` 与 `eventsource-parser` 成熟稳定，且均为轻量包，符合代理要求。 |
| Features | HIGH | 明确聚焦并能解决当前的业务痛点，严格遵循了 OpenAI 工具调用规范。 |
| Architecture | HIGH | 基于现有 Express 架构做组件级增强，未引发大的重构风险。 |
| Pitfalls | HIGH | 精准定位了常见 Node.js 代理及流处理中容易忽略的拼接与鉴权泄露问题。 |

**Overall confidence:** HIGH

### Gaps to Address

- **客户端渲染性能与体验权衡:** 暂不清楚 OpenCode 等特定客户端对 `tool_calls` 的增量流响应（Delta Streaming）实时性要求有多高。如果在代理层缓冲直到单个工具块结束，可能会造成轻微的渲染卡顿。在 Phase 3 实现时，需通过联调体验来决定是否引入 `partial-json` 进行更细致的增量修复。

## Sources

### Primary (HIGH confidence)
- 项目 `PROJECT.md` — 确立了修复和优化的核心约束与目标
- OpenAI 官方文档 — 确认了标准的 Tool Calling 和分块流 (SSE) 数据结构规范

### Secondary (MEDIUM confidence)
- NPM 生态 — 确认 `jsonrepair`, `eventsource-parser` 的最新兼容性和特性支持
- `.planning/research/*.md` — STACK, FEATURES, ARCHITECTURE, PITFALLS 等基础研究文档的内容总结

---
*Research completed: 2026-07-12*
*Ready for roadmap: yes*
