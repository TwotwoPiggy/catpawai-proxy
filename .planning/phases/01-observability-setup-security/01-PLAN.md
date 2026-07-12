---
wave: 1
depends_on: []
files_modified:
  - clean/redact.js
  - clean/logger.js
  - clean/catpawai-client.js
  - clean/app.js
  - .env.example
  - test/redact.test.js
  - test/logger.test.js
  - test/catpawai-client.test.js
autonomous: true
---

# Phase 1 Plan: Observability Setup & Security

本阶段专注于为 CatPawAI 代理建立健壮的可观测性基础设施和数据安全防线，主要涉及两个需求：
- **OBS-01**: 拦截控制台日志并对敏感凭据（如 Bearer token, Cookie 等）进行脱敏掩码。
- **OBS-02**: 增强结构化分级日志系统，并优雅地分类、捕获与透传上游连接错误，防止流式传输导致进程意外崩溃。

---

## Wave 1: 基础设施增强（Logging & Redaction）

### 任务 1.1: 增强 `clean/redact.js` 敏感信息脱敏 (OBS-01)
<read_first>
- `clean/redact.js`
</read_first>

<action>
修改 `clean/redact.js`，提升脱敏覆盖范围：
1. 扩展 `SENSITIVE_KEY_RE` 正则表达式，使其能够不区分大小写地匹配 `catpaw-auth` 键。
2. 增强 `redactString(value)` 逻辑：
   - 添加正则替换，将匹配 `catpaw-auth` 的 HTTP 头部值或 JSON 属性值掩码为 `[REDACTED]`。
   - 添加正则替换，将匹配含有 `1d47d6ff96_passportid` 或 `f32a546874_ssoid` 的 Cookie 字段值掩码为 `[REDACTED]`。
   - 在运行时，若 `process.env.CATPAWAI_ACCESS_TOKEN` 存在且非空，使用该值进行全局文本查找，并替换为 `[REDACTED]`。
   - 在运行时，若 `process.env.CATPAWAI_MIS_ID` 存在且非空，使用该值进行全局文本查找，并替换为 `[REDACTED]`。
3. 增强 `redactObject(value)` 逻辑：
   - 增加深层递归处理。若属性值是 String 类型，需在此基础上调用 `redactString(value)` 过滤，确保即使字段名不敏感，值中夹带的敏感 Token 也可被深度擦除。
</action>

<acceptance_criteria>
- 在 `test/redact.test.js` 中新增以下验证点：
  1. `Catpaw-Auth: token123` 应该被脱敏为 `Catpaw-Auth: [REDACTED]`。
  2. `Cookie: 1d47d6ff96_passportid=abc; f32a546874_ssoid=def` 应该被脱敏为 `Cookie: 1d47d6ff96_passportid=[REDACTED]; f32a546874_ssoid=[REDACTED]`。
  3. 临时设置 `process.env.CATPAWAI_ACCESS_TOKEN = 'mock-access-token'`，验证 `redactString('The local token mock-access-token is configured')` 的输出包含 `[REDACTED]` 且不包含 `mock-access-token`。
  4. 临时设置 `process.env.CATPAWAI_MIS_ID = 'mis-999'`，验证 `redactString('MIS is mis-999')` 成功掩码。
- 执行 `npm test` 通过，控制台没有报错。
</acceptance_criteria>

### 任务 1.2: 增强 `clean/logger.js` 实现分级结构化日志 (OBS-02)
<read_first>
- `clean/logger.js`
- `clean/redact.js`
</read_first>

<action>
重构并增强 `clean/logger.js` 模块：
1. 移除直接使用 `console.log` 的简单包装，在模块中定义 `LOG_LEVELS` 等级字典（`debug: 0`, `info: 1`, `warn: 2`, `error: 3`）。
2. 从环境变量 `process.env.LOG_LEVEL` 动态读取当前配置的日志级别（不区分大小写），默认值为 `info`。
3. 提供 `debug(message, meta)`、`info(message, meta)`、`warn(message, meta)` 和 `error(message, meta)` 四个标准的日志输出方法。
4. 提供 `log(message, meta)` 别名方法，直接映射到 `info`，以向后兼容现有代码。
5. 所有输出的日志在行首附加分级前缀标签，格式为：`[catpawai-proxy] [LEVEL] `，例如 `[catpawai-proxy] [INFO] message`。
6. 支持附加 `meta` 参数输出（结构化上下文）：
   - 如果 `meta` 属于 `Error` 实例，在日志后换行打印其 `meta.stack` 或 `meta.message`。
   - 如果 `meta` 属于非空对象，通过 `redactObject` 进行深度脱敏，将其序列化为 JSON 字符串拼接到日志后面。
   - 其他类型的 `meta`，转换为字符串并通过 `redactString` 脱敏后拼接。
7. 所有输出流均强制经过 `redactString` 过滤，确保即使日志级别改变，输出依然受到敏感凭据掩码保护。
</action>

<acceptance_criteria>
- 新建 `test/logger.test.js` 文件，实现以下自动化测试用例：
  1. 当 `process.env.LOG_LEVEL` 设为 `warn` 时，调用 `debug()` 和 `info()` 不应在 stdout 中产生输出，而 `warn()` 和 `error()` 应有输出。
  2. 验证日志包含规范的前缀，例如 `[catpawai-proxy] [ERROR] message`。
  3. 验证当 `meta` 传入包含 `Authorization` 的敏感对象时，输出中敏感内容已被替换成 `[REDACTED]`。
  4. 验证当传入 Error 对象时，能正确在控制台输出其堆栈。
- 运行 `node --test test/logger.test.js` 返回成功。
</acceptance_criteria>

### 任务 1.3: 更新 `.env.example` 配置文件 (OBS-01 & OBS-02)
<read_first>
- `.env.example`
</read_first>

<action>
在 `.env.example` 中新增 `LOG_LEVEL` 相关的环境变量注释与默认配置，以便于开发者部署或本地运行时参考。
</action>

<acceptance_criteria>
- 检查 `.env.example` 确实包含 `LOG_LEVEL=info`。
</acceptance_criteria>

---

## Wave 2: 错误分类与应用集成

### 任务 2.1: 拦截并分类 `catpawai-client.js` 的 Upstream 错误 (OBS-02)
<read_first>
- `clean/catpawai-client.js`
- `clean/errors.js`
</read_first>

<action>
增强 `catpawai-client.js`，拦截网络请求并包装系统级和超时异常：
1. 在 `requestChatCompletion` 方法中，使用 `try/catch/finally` 对 `fetchImpl` 网络调用及其响应状态校验进行全包裹。
2. 在 `catch (err)` 中，实现精准的错误分类：
   - 若捕获的错误本身是 `AppError` 实例，不做拦截直接向下抛出。
   - 若捕获的异常 `err.name === 'AbortError'`，这代表网络请求超时，抛出 `new AppError(504, 'catpawai_upstream_timeout', 'Request to upstream timed out.', 'upstream_error')`。
   - 若捕获的异常带有系统网络错误码，例如 `err.code === 'ENOTFOUND'`、`ECONNREFUSED` 或 `EADDRNOTAVAIL`，这代表无法建立与上游的连接，抛出 `new AppError(502, 'catpawai_connection_failed', 'Failed to establish connection to CatPawAI upstream.', 'upstream_error')`。
   - 捕获其他任何异常（包括流解析/读取中断等），均包装为统一的 `new AppError(502, 'catpawai_upstream_error', err.message || 'Unknown upstream request error.', 'upstream_error')`。
3. 增强 `createSseTransform` 中 `transform(chunk, controller)` 和 `flush(controller)` 的健壮性：
   - 用 `try/catch` 逻辑将内部的解密与 JSON 解析（`parseSsePayload` 等）进行封装。
   - 一旦中途解析发生崩溃或不可读，抛出 `AppError`（状态码 502，错误码 `catpawai_stream_interrupted`），由外层 Stream Pipe 错误机制统一拦截，防止进程意外崩溃退出。
</action>

<acceptance_criteria>
- 在 `test/catpawai-client.test.js` 中新增三个异常处理边界的测试用例：
  1. 使用 Mock `fetchImpl` 模拟超时抛出 `AbortError`，断言 `requestChatCompletion` 被 reject，捕获到的错误是 status 为 504 的 `AppError`。
  2. 使用 Mock `fetchImpl` 模拟 DNS 无法解析抛出 `ENOTFOUND`，断言被 reject 且错误状态码为 502。
  3. 使用 Mock `fetchImpl` 返回非 2xx 的上游 HTTP 状态，断言被 reject 且包含正确的 status 和 body 描述。
- 运行 `node --test test/catpawai-client.test.js` 能够 100% 成功通过。
</acceptance_criteria>

### 任务 2.2: 在 `clean/app.js` 中集成结构化 logger 并防御流传输崩溃 (OBS-02 & OBS-01)
<read_first>
- `clean/app.js`
- `clean/logger.js`
</read_first>

<action>
重构路由及中间件处理层，接入健壮的日志输出和异常捕获机制：
1. 引入增强后的 `clean/logger.js`。
2. 在流模式响应路由中（`app.post('/v1/chat/completions')`），修改管道输出：
   - `Readable.fromWeb(upstream.body)` 在 `.pipe(res)` 之前，挂载错误监听事件 `stream.on('error', (err) => { ... })`。
   - 在错误监听器中，使用 `logger.error` 记录 `Stream transmission error`（携带 Error 对象），并通过 `res.destroy()` 主动销毁响应，以确保客户端得知流传输发生故障，同时避免该未捕获异常抛至顶级导致 Node.js 进程崩塌。
3. 在普通和流式 API 的全局 catch 块中，以及全局错误处理中间件 `app.use((error, _req, res, _next) => { ... })` 里，在将 HTTP 状态和错误 JSON 返回客户端前，统一调用 `logger.error` 将详细错误堆栈（如 `error` 实例）记录至控制台，并确保敏感凭据被脱敏过滤。
</action>

<acceptance_criteria>
- 运行完整的测试套件 `npm test`，现有的 HTTP 测试和新增的 logger、redact、client 测试都通过。
- 当客户端发送出错请求或发生上游错误时，控制台输出格式应显示为结构化的 `[catpawai-proxy] [ERROR] Chat completion failed: ...` 并且没有包含明文的 `Authorization` 敏感值。
</acceptance_criteria>

---

## Must-Haves (Goal-Backward Verification)
本阶段的核心设计最终需满足：
- [ ] 所有控制台日志输出（`[catpawai-proxy] [...]`）皆必须经过敏感字过滤。在日志输出中不能出现明文 Bearer 令牌或以 `CATPAWAI_ACCESS_TOKEN` 定义的真实串。
- [ ] 本地开发的日志默认只打印 `[INFO]` 及以上，`[DEBUG]` 需由 `LOG_LEVEL=debug` 控制开启。
- [ ] 当与上游的连接断开或无法触达时，API 不会使 Node.js 应用崩溃挂掉，且能向客户端返回 502 状态和 OpenAI 兼容的 Error JSON 报文。
- [ ] 当请求由于连接时间过长而中断（达到 `CATPAWAI_TIMEOUT_MS`），API 应返回 504 状态码，且能够正确通知客户端。

---

## Artifacts this phase produces:
- **New Path:** `test/logger.test.js` (单元测试文件)
- **Modified Paths:**
  - `clean/redact.js`
  - `clean/logger.js`
  - `clean/catpawai-client.js`
  - `clean/app.js`
  - `.env.example`
  - `test/redact.test.js`
  - `test/catpawai-client.test.js`
- **New/Enhanced Symbols:**
  - `logger.debug(message, meta)`: 日志输出方法
  - `logger.info(message, meta)`: 日志输出方法
  - `logger.warn(message, meta)`: 日志输出方法
  - `logger.error(message, meta)`: 日志输出方法
  - `logger.log(message, meta)`: 兼容性方法，映射到 `logger.info`
  - `process.env.LOG_LEVEL`: 控制日志级别
  - `AppError` wrapping logic (network/timeout errors wrapped with custom status codes inside `requestChatCompletion`)
