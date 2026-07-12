# Pitfalls Research

**Domain:** AI Proxy Tool Calling Fix & Optimization (Node.js/Express)
**Researched:** 2026-07-12
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: 忽略 SSE 流中的工具调用块拼接导致解析失败 (Ignoring SSE Chunking for Tool Calls)

**What goes wrong:**
流式响应 (SSE) 中的 `tool_calls` 数据往往跨越多个数据块 (chunks)。直接尝试在单块内解析 JSON 会导致 `SyntaxError`，或者丢失后续参数片段，最终返回给客户端残缺或非法的结构。

**Why it happens:**
开发者习惯于完整请求/响应模式，在处理 `stream` 时，仅仅对每个到达的 `chunk` 独立执行处理，忽略了长文本 `arguments` 会被上游（如 CatPawAI）截断成多个流片段发送的事实。

**How to avoid:**
引入状态机或缓冲对象，在内存中持续拼接属于同一个工具调用的 `arguments` 字符串，直到该工具调用流结束，最后再统一封装。

**Warning signs:**
日志中频繁出现 `SyntaxError: Unexpected end of JSON input`；客户端 (如 OpenCode) 报告收到的参数字符串被截断，且缺失闭合括号。

**Phase to address:**
工具调用数据解析修复 (Tool Call Parsing Fix)

---

### Pitfall 2: 多并行工具调用索引错乱 (Parallel Tool Calling Index Mishandling)

**What goes wrong:**
当模型一次性返回多个工具调用 (并行工具调用) 时，SSE 流中通常会通过 `index` 字段区分不同工具的数据块。如果不按 `index` 聚合，而是盲目拼接，会导致参数错乱甚至生成非法的 JSON 结构（如文档中指出的 `{"tool_calls": {...}, {...}}`，缺少数组边界包裹）。

**Why it happens:**
实现时假设模型只会按顺序依次返回一个工具，或者未充分阅读上游数据协议中对于多个工具调用流的 `index` 说明，采用了粗暴的字符串替换拼接。

**How to avoid:**
在内存中维护一个映射字典 (Map 或 Array)，以 `index` 为键聚合对应的 `id`, `type`, `function.name`, 和 `function.arguments`。最终向客户端下发完整结构时，将这些缓冲值转换为标准的 JSON 数组格式 `[{...}, {...}]`。

**Warning signs:**
返回给客户端的 `tool_calls` 结构是逗号分隔的对象而不是被 `[]` 包裹的合法数组；客户端无法识别出并行工具。

**Phase to address:**
并行工具调用兼容性优化 (Parallel Tool Call Compatibility)

---

### Pitfall 3: 在日志记录中泄漏敏感凭证 (Credential Leakage in Error Logs)

**What goes wrong:**
优化错误处理机制和日志输出时，直接将上游请求/响应对象（如 `req.headers` 或完整的 axios/fetch 错误对象）整个 dump 到控制台。这会导致 CatPawAI 的 access tokens, Authorization 头部信息被写入本地终端甚至日志文件。

**Why it happens:**
Node.js 开发者在排查工具调用失败等问题时，常使用 `console.error(err)` 或深度打印请求/响应体来快速调试，忽略了 `err.config.headers` 等位置深藏了用户凭权信息。

**How to avoid:**
实现统一的日志过滤器和脱敏工具。在日志输出前，明确剔除或掩码 `Authorization`, `Catpaw-Auth`, `CATPAWAI_ACCESS_TOKEN` 等关键字段，只暴露有用的状态码和错误报文。

**Warning signs:**
控制台或日志文件里可直接看到长串的 Token 字符；使用全局搜索工具查找 token 能命中 `.log` 结尾的文件。

**Phase to address:**
错误处理与日志优化 (Error Handling & Logging Optimization)

---

### Pitfall 4: 阻塞或吞噬上游服务错误 (Swallowing Upstream Errors in Stream)

**What goes wrong:**
请求 CatPawAI 上游失败（如 401 鉴权失效、500 服务内部错误）时，代理端仅仅捕获了异常但未能正确地转发给 OpenAI 兼容客户端（例如保持 HTTP 连接挂起或返回 200 OK 加空响应），导致客户端陷入无限等待或静默失败。

**Why it happens:**
在处理 SSE 数据流时，如果在已经下发了初始的 HTTP Header（如 `200 OK`）之后发生了网络错误，通常无法再更改 HTTP 状态码。此时如果未主动断开 Socket 连接或者未输出标准的错误数据块，下游客户端无法感知异常。

**How to avoid:**
初始连接时必须完整检查上游返回的初始状态；对于流传输期间的中断，代理必须妥善发送结束帧或直接中止底层的 Socket 连接 (`res.destroy(err)`) 告知下游错误。

**Warning signs:**
OpenCode 等工具发出含有工具调用的命令后无反应、假死；或者代理控制台有报错但客户端界面认为请求成功且结束。

**Phase to address:**
错误处理与日志优化 (Error Handling & Logging Optimization)

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 使用正则替换或强硬的字符插入修复 JSON | 快速修复因缺少 `[` 或 `]` 导致的并行工具格式错误 | 遇到带特殊字符的 args 时正则极易崩溃，产生无法调试的隐藏语法错误 | 绝不可行 (never) |
| 直接在原有路由中硬编码转换逻辑 | 免去重构 `catpawai-client.js` 解析模块的成本 | 路由代码变得极其庞大且难以维护，增加新的流式特性困难重重 | 仅限临时验证 (MVP)，最终提交不可接受 |
| 仅针对 `opencode` 进行格式特判适配 | 快速满足当前最紧急的兼容需求 | 换一个客户端 (如 Cursor) 仍然失败，系统缺乏作为通用代理的一致性 | 只有在 deadline 极紧时 (never preferred) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CatPawAI 流接口 | 假设 `function.arguments` 在单个 SSE chunk 里必定是完整的 JSON 片段 | 将所有属于同一 `index` 的 `arguments` chunk 字符串拼接完成后，再整体校验格式 |
| 兼容 OpenAI 格式客户端 | 不返回 `id`，或使用固定的静态 `id` 作为占位 | 必须生成唯一的 `call_xxx` 格式的 id，并且保证其与工具名称及参数结构强绑定对应 |
| 本地配置和 Token 注入 | 将包含 Token 错误的详细上游堆栈直接返回给下游 | 在代理层截获上游错误并做脱敏，组装标准的 OpenAI 格式错误返回，以防敏感信息扩散到客户端界面 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 在内存中累积所有流结束后再统一转发 | 首字节时间 (TTFB) 极高，客户端打字机效果彻底消失 | 混合流处理：边聚合 Tool 调用（仅工具调用部分需要缓冲以保证格式），边流式输出普通文本消息 | 当模型响应内容超过几百个 Token 或有大量解释说明时 |
| 同步阻塞的复杂日志记录 | 代理大并发请求时整体响应延迟明显增加，甚至出现卡顿 | 对于大型请求体，避免使用深度很大的 JSON 同步序列化输出，采用结构化脱敏摘要日志 | 同时处理多并发请求或调试大量流输出时 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 错误及调试日志输出未脱敏 | 泄漏用户个人的 CatPawAI token 和鉴权信息到终端记录或第三方收集工具 | 实现专门的日志打印包装器，严格过滤 headers 和 env 相关的涉密值 |
| 代理服务绑定到 `0.0.0.0` | 这个属于个人内测级别的代理可能会被公网直接扫描探测并盗用 | 强制检查并约束 Express 服务器仅监听在本地环回地址 `127.0.0.1` |
| 未校验的上游重定向或反代目标 | 可能被 SSRF 漏洞利用转发请求至无关地址 | 锁定且仅允许向预设的 CatPawAI 域名及确定的代理路径发起通信 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 在工具调用发生解析错误时默默吞咽 | 客户端得不到结果停留在“执行中”，用户不得不强行中断程序 | 立刻截断响应，生成友好的 OpenAI 兼容的 system message 或 error 响应提示解析失败 |
| 终端日志满屏杂乱的 chunk 数据流 | 开发者难以找到报错根因，增加了调试这个 Node.js 代理的挫败感 | 控制台日志区分不同层级（如只打印出入站摘要和重要异常），将原始的流内容放到 DEBUG 层级 |

## "Looks Done But Isn't" Checklist

- [ ] **多工具并行处理:** 常常遗漏按 `index` 的聚合拆分——请实际验证 OpenCode 同时触发 `run_command` 和 `view_file` 两个工具调用时，代理返回的工具集合是否是格式规范的 JSON 数组结构。
- [ ] **参数包含换行和特殊字符:** 常常因为错误拼接或粗暴截取导致 JSON 解析失败——请验证当模型生成的代码/参数含有 `\n`, `"`, 以及对象花括号 `{}` 时，工具调用仍能顺畅还原解析。
- [ ] **上游鉴权/网络异常的透传:** 常常会因为 Node.js 本身捕获了异常而静默吞噬——请验证在 `.env` 中填入无效的 Token 时，OpenCode 能够直接提示鉴权失败而不是一直等待。
- [ ] **全路径的日志脱敏:** 常常在深层异常堆栈或者第三方库拦截器中漏写过滤——请验证抛出严重上游网络错误且开启调试日志时，代理的终端控制台严格不出现 `Bearer xxx...` 或真实的环境变量 token 值。

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| JSON 正则匹配修复引发边缘崩溃 | LOW | 立即撤回基于正则的 `catpawai-client.js` 解析修改，使用内存缓冲字典并依据流状态机的标准方式重建组装逻辑。 |
| 日志泄漏本地凭据 (Token Leakage) | MEDIUM | 第一时间清理控制台输出和任何落地的 `*.log` 文件；为防万一，建议清除在公用处的可能留存，并在代理工程源码内全面补齐日志过滤器函数。 |
| 并行工具调用返回错乱导致客户端失效 | LOW | 检查流块解析聚合逻辑中是否缺少 `index` 字段的正确映射覆盖，调整 Map 缓存结构并添加测试用例固定表现。 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 忽略 SSE 块拼接与截断 | 工具调用数据解析修复 (Tool Call Parsing Fix) | 运行包含超大参数量或长代码块写入的工具调用流式输出，验证截断与拼接准确无误 |
| 多并行工具调用索引错乱 | 并行工具调用兼容性优化 (Parallel Tool Call Compatibility) | 触发大模型向客户端发送多个互不相干的并行工具调用，抓包验证代理吐出的格式为合法 JSON 数组 |
| 日志未脱敏泄漏凭证 | 错误处理与日志优化 (Error Handling & Logging Optimization) | 构造鉴权失败的上游请求拦截，肉眼及 `rg` 脚本扫描验证控制台终端是否有凭证原文的意外泄露 |
| 吞噬流式错误状态 | 错误处理与日志优化 (Error Handling & Logging Optimization) | 中断网络或者截断上游响应，断言 OpenCode 客户端能够精准收到 HTTP Error 而非被挂死卡住 |

## Sources

- .planning/PROJECT.md 核心目标与安全约束指示
- OpenAI API Reference (关于 Tool Calls chunked streaming 的文档说明)
- Node.js Stream / SSE 处理中常见的错误聚合案例
- 项目中关于 OpenCode 解析兼容性的问题反馈

---
*Pitfalls research for: AI Proxy Tool Calling Fix & Optimization*
*Researched: 2026-07-12*
