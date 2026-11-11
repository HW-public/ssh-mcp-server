# Code Overview

单文件架构说明。运行时入口是 `src/index.ts`，打包后用 esbuild 打成单文件 `dist/bundle/index.mjs`，仅依赖 Node.js 20+。

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 入口：加载配置 → 创建 `HostRegistry` → 挂 `StdioServerTransport` |
| `src/config.ts` | 从产物所在目录向上查找 `.env` 并加载（真实环境变量优先），解析 `SSH_DEFAULT_*` 为默认主机 |
| `src/server.ts` | 5 个 Tool 的 schema 定义与 `CallTool` 分发；错误统一包成 `isError: true` 返回，不 crash |
| `src/ssh/types.ts` | `SSHHostConfig` / `HostInfo` / `ExecResult` 类型 |
| `src/ssh/client.ts` | ssh2 封装：`connect` / `execCommand` / `sftpUpload` / `sftpDownload` / `withConnection` |
| `src/ssh/registry.ts` | `HostRegistry`（add/get/list/names）+ `validateAndBuildHost` 入参校验 |
| `src/tools/index.ts` | 三个主机侧工具实现：`runCommand` / `uploadFile` / `downloadFile`，结果 JSON 化 |

## 关键设计

- **凭据安全**：`list_hosts` 只返回 `auth: 'password' | 'privateKey'`，密码/私钥内容永不出现在任何工具输出里。
- **add_host 先验证后注册**：`add_host` 先真正建立 SSH 连接，成功才写入 registry，避免 `list_hosts` 里出现连不通的主机。
- **连接即开即关**：每个工具调用独立连接、用完即关，不在工具间复用连接，行为可预期。
- **.env 解析与启动目录解耦**：从 `import.meta.url` 向上找 `.env`，单文件 Release 拷到任意目录都能加载同目录配置。
- **错误模型**：工具内部异常 → `{ content: [{ type: 'text', text: 'Error: ...' }], isError: true }`；MCP server 进程不退出。
