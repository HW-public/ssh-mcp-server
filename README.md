# SSH MCP Server

[English](README.EN.md) | 中文

一个基于 TypeScript 实现的 [Model Context Protocol](https://modelcontextprotocol.io/) 服务，让 Claude Code 可以通过 SSH 直接在远程主机上**执行命令**、**上传/下载文件**。

## 提供的工具

- `execute_command`：在远程主机上执行 shell 命令，返回 stdout / stderr / exitCode
- `upload_file`：通过 SFTP 上传本地文件到远程主机
- `download_file`：通过 SFTP 从远程主机下载文件
- `add_host`：**运行时动态添加 SSH 主机，无需重启**（会先验证连通性再注册）
- `list_hosts`：列出所有已配置的主机（绝不返回密码）

每个工具都支持可选参数 `host`（主机名称，见 `list_hosts`）。如果只配置了一个默认主机，会默认使用它。

### 动态添加主机

管理多台机器时，不用改配置重启，直接让 Claude 调用 `add_host`：

```
add_host(name="h3c-ubuntu", host="10.43.28.12", port=22022, user="root", password="***")
```

连接成功后即可通过 `host="h3c-ubuntu"` 在其他所有工具中使用。
注意：通过工具传入的凭据会出现在会话日志中，长期固定的主机建议仍用环境变量配置。

## 环境要求

- Node.js 20+
- Windows / Linux / macOS 均可（开发与构建验证基于 Windows）

## 用户安装（推荐，无需克隆/编译）

前提：Windows + Node.js 20+。打开 PowerShell 执行**一条命令**：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://cdn.jsdelivr.net/gh/HW-public/ssh-mcp-server@main/install.ps1'))"
```

脚本会自动：下载最新 Release 的单文件产物到 `%USERPROFILE%\ssh-mcp-server\` → 生成 `.env` 配置模板 → 注册 `.mcp.json` → 启用 `settings.local.json`。

然后编辑 `%USERPROFILE%\ssh-mcp-server\.env` 填入 SSH 凭据，重启 Claude Code 即可。

> 网络无法访问 jsDelivr 时，把脚本地址换成 `https://raw.githubusercontent.com/HW-public/ssh-mcp-server/main/install.ps1` 再试。

## 安装（开发者）

### 方式一：一键安装（本地仓库）

在项目目录执行一次：

```powershell
cd E:\IDEA\IDEAProject\Intellij_project\ssh-mcp-server
pnpm install
pnpm run bundle
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

脚本会自动完成：

1. 把单文件产物 `dist/bundle/index.mjs` 拷贝到 `release\`（默认，可用 `-InstallDir` 指定其他目录）
2. 把项目里真实的 `.env`（没有则用 `.env.example` 模板）复制为 `release\.env`
3. 注册/更新 `%USERPROFILE%\.mcp.json` 中的 `ssh-mcp-server`（原文件备份为 `.mcp.json.bak`）
4. 在 `settings.local.json` 中启用该服务器

之后**升级**只需重跑 `pnpm run bundle` + `install.ps1`。换机器只需拷贝 `release\` 文件夹（内含 `index.mjs` + `.env`），手动把 `.mcp.json` 里路径指向新位置即可——运行时仅依赖 Node.js，无需 node_modules。

### 方式二：常规安装（开发/调试）

本项目强制使用 [pnpm](https://pnpm.io/) 管理依赖。

```powershell
cd E:\IDEA\IDEAProject\Intellij_project\ssh-mcp-server
pnpm install
pnpm run build
```

如果你用 `npm install` 或 `yarn install`，`preinstall` 脚本会报错并阻止安装。

## 配置

### 1. 环境变量 / `.env` 文件

支持两种配置方式，优先级如下：

1. **系统环境变量**（最高优先级）
2. 安装目录下的 **`.env` 文件**（从产物所在目录向上查找，与启动目录无关）

示例 `.env`：

```env
# 默认 SSH 主机（可选；不配置则只能通过 add_host 工具动态添加）
SSH_DEFAULT_NAME=default
SSH_DEFAULT_HOST=10.43.28.12
SSH_DEFAULT_PORT=22
SSH_DEFAULT_USER=root

# 认证方式：密码 与 私钥 二选一
SSH_DEFAULT_PASSWORD=your_password
# SSH_DEFAULT_PRIVATE_KEY_PATH=C:\Users\you\.ssh\id_ed25519
# SSH_DEFAULT_PASSPHRASE=
```

也可以在启动 Claude Code 前用 PowerShell 设置：

```powershell
$env:SSH_DEFAULT_NAME = "default"
$env:SSH_DEFAULT_HOST = "10.43.28.12"
$env:SSH_DEFAULT_PORT = "22022"
$env:SSH_DEFAULT_USER = "root"
$env:SSH_DEFAULT_PASSWORD = "your_password"

claude
```

### 2. 在 Claude Code 中注册 MCP Server

使用一键安装（方式一）时此步已由脚本自动完成。手动注册时，在 `%USERPROFILE%\.mcp.json` 中添加（直接用 node 启动，不再经过 cmd 包装，避免转义问题）：

```json
{
  "mcpServers": {
    "ssh-mcp-server": {
      "command": "node",
      "args": ["C:\\Users\\you\\ssh-mcp-server\\release\\index.mjs"]
    }
  }
}
```

在 `%USERPROFILE%\.claude\settings.local.json` 中启用：

```json
{
  "enabledMcpjsonServers": [
    "ssh-mcp-server"
  ]
}
```

修改环境变量、`.mcp.json` 或重新构建后，请**重启 Claude Code** 使配置生效。

## 构建与运行

```powershell
pnpm run build
node dist/index.js
```

## 开发调试

无需编译，直接使用 `tsx` 运行：

```powershell
pnpm tsx src/index.ts
```

## 验证

重启 Claude Code 后，可以尝试：

- "列出所有已配置的 SSH 主机"
- "在默认主机上执行 `whoami`"
- "上传 C:\tmp\test.txt 到远程主机的 /tmp/test.txt"
- "把远程主机的 /var/log/syslog 下载到 C:\tmp\syslog"
- "添加一台新主机 192.168.1.20，用户 root，命名为 nas"
