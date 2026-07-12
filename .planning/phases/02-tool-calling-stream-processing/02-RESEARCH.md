# Phase 2: Tool Calling Stream Processing - Research

## 1. 阶段目标与背景 (Phase Objective & Context)

- **核心目标**: 在流式处理 (Stream Processing) 过程中正确缓冲工具调用的数据块 (chunks)，并自动修复其中格式损坏的 JSON 参数。
- **关联需求**: 
  - **CORE-01**: 代理拦截来自流中的格式损坏的 `tool_calls` 参数，并在转发给客户端前将其自动修复为有效 JSON。
  - **CORE-02**: 代理应正确地缓冲和拼接属于同一工具索引 (tool index) 的流数据块。
- **设计原则**: 继续保持零依赖原则 (Zero-dependency)，不引入额外的解析库。必须保证不影响正常文本/内容 (content) 的流式传输响应速度。

## 2. 代码现状分析 (Codebase Analysis)

基于当前的架构与文件分析：
- **`clean/app.js`**: `POST /v1/chat/completions` 会处理流式响应，目前通过 `Readable.fromWeb(upstream.body)` 和 `nodeStream.pipe(res)` 直接将流返回客户端。根据上下文提示，这是进一步介入 SSE 拦截的关键位置，可以在这里或在其底层的返回管道中做一层过滤。
- **`clean/catpawai-client.js`**: 现有的 `createSseTransform` 实现了从底层流解析并将其转换为符合 OpenAI 规范的 SSE 行 (`toOpenAiStreamLine`) 的能力。
在当前实现中，数据是按块透传的。对于 `tool_calls`，由于大模型流式输出容易截断或带格式错误，会导致客户端直接 Parse 时崩溃，因此必须在流转输的过程中增加检测和修复逻辑。

## 3. 技术实施策略 (Technical Strategy)

### 3.1 SSE 数据流拦截与分离 (Stream Interception Strategy)
- **按块分类 (D-01)**: 拦截机制需识别 SSE 数据块的类型。对于包含纯 `content`（普通对话文本）的 chunks，直接让其无阻碍地通过 (pass-through)，以保持低延迟响应。
- 只有包含 `tool_calls` 结构的数据块才会被拦截并移入专属的缓冲处理器。

### 3.2 缓冲与合并机制 (Buffering & Concatenation)
- **按工具索引缓冲 (D-03)**: 实现一个缓冲状态管理（可结合在 TransformStream 内）。
- 当捕获到 `tool_calls` 数据时，根据 `index` 对其 `arguments` (或 `name` 等信息) 进行字符串拼接缓冲。
- **触发发送**: 当检测到当前工具的数据块发送完成（如遇到新的 `index` 块，遇到 `finish_reason`，或者流结束标志 `[DONE]`），再将拼接好的工具调用进行校验、修复，并作为单个完整且合法的 Chunk Emit 出去，确保客户端始终接收到合法的整块工具请求。

### 3.3 JSON 自动修复 (JSON Repair Approach)
- **原生字符串操作 (D-02)**: 基于零外部依赖限制，使用纯原生的字符串操作配合 `JSON.parse` / `JSON.stringify` 机制修复异常的 `arguments`。
- **修复措施**: 
  - 剔除 markdown 格式残留（如 ```json 标签）。
  - 自动匹配和修补未闭合的大括号 `}` 或中括号 `]`。
  - 通过 `try...catch` 包裹解析逻辑，多次迭代修复手段，直至解析成功，最后转回合法字符串发送给客户端。

## 4. 依赖项与资产重用 (Dependencies & Reusable Assets)

- **零新依赖**: 延续 Phase 1，不在 `package.json` 中添加任何外部 JSON 容错或流操作库。
- **日志追踪 (`clean/logger.js`)**: 在拦截、缓冲流以及执行 JSON 修复时，利用第一阶段已建立的结构化日志系统 (logger) 记录修复动作的成功与失败、拦截行为以及流数据丢块异常。这充分满足了 OBS-01 与 OBS-02 维度的可观测性需求。

## 5. 验证与测试策略 (Validation Strategy)

- **有效性验证 (UAT)**: 
  - **文本直通验证**: 模拟常规的长篇文本响应流，确保工具回调修复逻辑不会阻塞文本输出，保证性能与极低首字节延迟。
  - **缓冲与拼接验证 (CORE-02)**: 向处理层发送分散的多块相同 `index` 的 `tool_calls` 数据，验证最终输出的是一块合并了所有内容的工具调用块。
  - **修复验证 (CORE-01)**: 刻意伪造残缺的 JSON 格式 (如缺失结尾大括号、携带特殊非 JSON 转义符) 的 `tool_calls` 块，验证系统成功拦截、修复该异常，并对外输出合规 JSON。
- **容错验证**: 遇到彻底无法修复的工具块，确保系统能够抛出规范的内部处理异常并在日志中警告，而非直接 Crash。

## RESEARCH COMPLETE
