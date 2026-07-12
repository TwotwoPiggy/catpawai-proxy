# CatPawAI Proxy Tool Calling Fix & Optimization

## Current Milestone: v1.0 Tool Calling Fix & Optimization

**Goal:** 修复并全面优化代理的工具调用功能，以兼容 OpenCode 等客户端。

**Target features:**
- 修复 `tool_calls` 返回的无效 JSON 格式（缺少数组边界等）
- 完善系统对多个并行工具调用的兼容性
- 优化错误处理机制和日志输出格式

## What This Is

一个将 OpenAI 兼容的 API 请求（如来自 OpenCode 的请求）转换为 CatPawAI 原生请求的本地 Express.js 代理。当前重点是修复工具调用时返回的 JSON 格式错误，并全面优化代理的工具兼容性、错误处理和日志记录。

## Core Value

确保 OpenAI 兼容客户端与 CatPawAI 后端之间能够无缝、稳定且格式正确地进行工具调用（Tool Calling）。

## Requirements

### Validated

- ✓ 提供本地 HTTP 服务，将 OpenAI 格式代理到 CatPawAI — existing
- ✓ 基础的聊天补全流式输出 (Streaming) — existing
- ✓ 通过环境变量和脚本进行配置 — existing

### Active

- [ ] 修复 `tool_calls` 响应中的无效 JSON 格式问题（如缺少数组括号）。
- [ ] 完善整体工具调用兼容性，确保多个并行工具调用能被正确解析和转发。
- [ ] 优化代理的错误处理和日志输出，提升调试体验和性能。

### Out of Scope

- [公开的 API 网关] — 这是一个用于个人/内部工具测试的本地代理，不应暴露在公网。
- [复杂的鉴权流程] — 继续依赖现有的 `.env` 和脚本注入鉴权，不增加额外的鉴权复杂度。

## Context

- **运行环境**: Node.js >= 18, Express.
- **主要客户端**: `opencode` 及类似 AI 命令行工具。
- **当前已知问题**: `opencode` 接收到格式错误的 `tool_calls` JSON（例如：`{"tool_calls": {...}, {...}}` 而不是合法的 JSON 数组）。
- **代码库基础**: 代码库映射已完成（位于 `.planning/codebase/`），解析和格式化逻辑主要集中在 `clean/catpawai-client.js`。

## Constraints

- **本地网络限制**: 必须保持绑定在 `127.0.0.1`，确保安全。
- **安全**: 不能在控制台日志中泄漏 CatPawAI tokens 等敏感凭据。
- **依赖性**: 强依赖于 CatPawAI 上游的 `/openai/stream` SSE 接口返回格式。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 优先修复 JSON 工具调用格式 | 阻塞了 OpenCode 的正常工作 | — Pending |
| 增强错误处理和日志 | 帮助更好地诊断上游 CatPawAI 的异常 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-12 after initialization*
