# Graph Report - catpawai-proxy  (2026-07-12)

## Corpus Check
- 36 files · ~10,829 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 289 nodes · 426 edges · 26 communities (22 shown, 4 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9cff7583`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- catpawai-client.js
- app.js
- package.json
- CatPawAI Proxy
- sync_server_env_paramiko.py
- server.js
- CatPawAI Proxy
- import-from-catpaw-state.js
- catpawai-client.test.js
- catpaw-crypto.js
- AGENTS.md
- diagnose.js
- Architecture
- Conventions
- Integrations
- Tech Stack
- Testing
- configure-from-catpaw-config.ps1
- Directory Structure
- Concerns
- install-systemd.sh
- start-linux.sh

## God Nodes (most connected - your core abstractions)
1. `CatPawAI Proxy` - 14 edges
2. `CatPawAI Proxy` - 14 edges
3. `requestChatCompletion()` - 12 edges
4. `convertTextToToolCalls()` - 10 edges
5. `createApp()` - 9 edges
6. `scripts` - 9 edges
7. `createInstalledCatPawCrypto()` - 8 edges
8. `inferToolCallsFromText()` - 8 edges
9. `createChatCompletion()` - 8 edges
10. `main()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `createApp()` --indirect_call--> `request()`  [INFERRED]
  clean/app.js → test/http.test.js
- `readStorageValue()` --indirect_call--> `error()`  [INFERRED]
  scripts/import-from-catpaw-state.js → clean/logger.js
- `createApp()` --indirect_call--> `error()`  [INFERRED]
  clean/app.js → clean/logger.js
- `parseSsePayload()` --calls--> `createInstalledCatPawCrypto()`  [EXTRACTED]
  clean/catpawai-client.js → clean/catpaw-crypto.js
- `readResponsePayload()` --calls--> `createInstalledCatPawCrypto()`  [EXTRACTED]
  clean/catpawai-client.js → clean/catpaw-crypto.js

## Import Cycles
- None detected.

## Communities (26 total, 4 thin omitted)

### Community 0 - "catpawai-client.js"
Cohesion: 0.08
Nodes (56): adaptCompletionToolCalls(), { AppError }, buildCatPawNativePayload(), buildMessagesWithToolInstruction(), buildToolInstruction(), buildToolResultContinuationInstruction(), buildUpstreamPayload(), convertTextToToolCalls() (+48 more)

### Community 1 - "app.js"
Cohesion: 0.10
Nodes (22): { AppError, openAiError }, cors, createApp(), { DEFAULT_MODEL_ID, MODELS }, defaultCatPawAiClient, express, { Readable }, validateChatRequest() (+14 more)

### Community 2 - "package.json"
Cohesion: 0.07
Nodes (27): cors, dotenv, express, dependencies, cors, dotenv, express, description (+19 more)

### Community 3 - "CatPawAI Proxy"
Cohesion: 0.09
Nodes (20): CatPawAI Proxy, GitHub 上传说明, Token 生命周期, Ubuntu 部署, Windows 端口说明, 免责声明, 功能, 安全说明 (+12 more)

### Community 4 - "sync_server_env_paramiko.py"
Cohesion: 0.29
Nodes (17): Any, Namespace, Path, build_restart_command(), file_hash(), load_config(), main(), parse_args() (+9 more)

### Community 5 - "server.js"
Cohesion: 0.17
Nodes (12): error(), log(), { redactString }, redactObject(), redactString(), app, { createApp }, { log } (+4 more)

### Community 6 - "CatPawAI Proxy"
Cohesion: 0.14
Nodes (14): CatPawAI Proxy, Configuration, Disclaimer, Endpoints, Features, GitHub Safety, Importing CatPawAI Auth, Models (+6 more)

### Community 7 - "import-from-catpaw-state.js"
Cohesion: 0.22
Nodes (13): baseUrlForTenant(), ENV_EXAMPLE_PATH, ENV_PATH, fs, loadSqlite3(), main(), path, pickModel() (+5 more)

### Community 8 - "catpawai-client.test.js"
Cohesion: 0.17
Nodes (11): buildCatPawHeaders(), buildRequestHeaders(), getCatPawVersions(), getPlatformInfo(), readJsonValueByRegex(), { AppError }, assert, {
  buildCatPawHeaders,
  buildCatPawNativePayload,
  buildRequestHeaders,
  buildUpstreamPayload,
  createChatCompletion,
  discoverCatPawAi,
  normalizeBaseUrl,
} (+3 more)

### Community 9 - "catpaw-crypto.js"
Cohesion: 0.24
Nodes (11): createCatPawCrypto(), createInstalledCatPawCrypto(), crypto, fs, path, PROJECT_EXTENSION_JS, readKeyPairFromExtension(), resolveDefaultExtensionPath() (+3 more)

### Community 10 - "AGENTS.md"
Cohesion: 0.29
Nodes (5): 发布边界, 文档规范, 禁止提交, 维护检查, 项目定位

### Community 11 - "diagnose.js"
Cohesion: 0.38
Nodes (6): checkPort(), fileExists(), fs, main(), net, path

### Community 13 - "Architecture"
Cohesion: 0.40
Nodes (4): Architecture, Data Flow, Key Abstractions, System Design

### Community 14 - "Conventions"
Cohesion: 0.40
Nodes (4): Code Style, Conventions, Error Handling, Naming

### Community 15 - "Integrations"
Cohesion: 0.40
Nodes (4): Authentication Providers, Crypto, External APIs, Integrations

### Community 16 - "Tech Stack"
Cohesion: 0.40
Nodes (4): Configuration, Core Technologies, Dependencies, Tech Stack

### Community 17 - "Testing"
Cohesion: 0.40
Nodes (4): Current Practices, Framework, Structure, Testing

### Community 19 - "Directory Structure"
Cohesion: 0.50
Nodes (3): Directory Structure, Key Files, Layout

## Knowledge Gaps
- **121 isolated node(s):** `{ Readable }`, `{ AppError, openAiError }`, `defaultCatPawAiClient`, `{ DEFAULT_MODEL_ID, MODELS }`, `crypto` (+116 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `app.js` to `server.js`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `error()` connect `server.js` to `app.js`, `import-from-catpaw-state.js`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `readStorageValue()` connect `import-from-catpaw-state.js` to `server.js`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `createApp()` (e.g. with `app.js` and `error()`) actually correct?**
  _`createApp()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ Readable }`, `{ AppError, openAiError }`, `defaultCatPawAiClient` to the rest of the system?**
  _122 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `catpawai-client.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07644110275689223 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09852216748768473 - nodes in this community are weakly interconnected._