# SSH MCP Server

[中文](README.md) | English

A [Model Context Protocol](https://modelcontextprotocol.io/) server implemented in TypeScript that lets Claude Code **execute commands** and **transfer files** on remote hosts over SSH.

## Tools

- `execute_command`: run a shell command on a remote host, returns stdout / stderr / exitCode
- `upload_file`: upload a local file to a remote host via SFTP
- `download_file`: download a file from a remote host via SFTP
- `add_host`: **connect to an additional SSH host at runtime — no server restart needed** (connectivity is verified before registering)
- `list_hosts`: list all configured hosts (never returns passwords)

Every tool accepts an optional `host` parameter (see `list_hosts`). If only one default host is configured, it is used automatically.

### Adding a host dynamically

To manage multiple machines without editing config or restarting, let Claude call `add_host`:

```
add_host(name="h3c-ubuntu", host="10.43.28.12", port=22022, user="root", password="***")
```

The new host is then available via `host="h3c-ubuntu"` in all other tools.
Note: credentials passed via tools appear in session logs; prefer environment variables for permanent hosts.

## Requirements

- Node.js 20+
- Windows / Linux / macOS (developed and verified on Windows)

## User install (recommended — no clone/build needed)

Prerequisites: Windows + Node.js 20+. Open PowerShell and run **one command**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://cdn.jsdelivr.net/gh/HW-public/ssh-mcp-server@main/install.ps1'))"
```

The script will: download the latest Release single-file bundle to `%USERPROFILE%\ssh-mcp-server\` → generate a `.env` template → register it in `.mcp.json` → enable it in `settings.local.json`.

Then edit `%USERPROFILE%\ssh-mcp-server\.env`, fill in your SSH credentials, and restart Claude Code.

> If jsDelivr is unreachable, replace the script URL with `https://raw.githubusercontent.com/HW-public/ssh-mcp-server/main/install.ps1`.

## Install (for developers)

### Option 1: one-click install (local repo)

Run once in the project directory:

```powershell
cd E:\IDEA\IDEAProject\Intellij_project\ssh-mcp-server
pnpm install
pnpm run bundle
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The script will:

1. Copy the single-file bundle `dist/bundle/index.mjs` to `release\` (default; override with `-InstallDir`)
2. Copy the project's real `.env` (or the `.env.example` template) to `release\.env`
3. Register/update `ssh-mcp-server` in `%USERPROFILE%\.mcp.json` (original backed up as `.mcp.json.bak`)
4. Enable the server in `settings.local.json`

To **upgrade** later, just re-run `pnpm run bundle` + `install.ps1`. To move machines, copy the `release\` folder (`index.mjs` + `.env`) and point `.mcp.json` at the new location — the runtime only needs Node.js, no node_modules.

### Option 2: regular install (development/debugging)

This project enforces [pnpm](https://pnpm.io/).

```powershell
cd E:\IDEA\IDEAProject\Intellij_project\ssh-mcp-server
pnpm install
pnpm run build
```

`npm install` / `yarn install` are blocked by the `preinstall` script.

## Configuration

### 1. Environment variables / `.env` file

Two ways, priority order:

1. **System environment variables** (highest priority)
2. **`.env` file** next to (or above) the bundle — resolved from the artifact's own directory, independent of the working directory

Example `.env`:

```env
# Default SSH host (optional; without it, use the add_host tool at runtime)
SSH_DEFAULT_NAME=default
SSH_DEFAULT_HOST=10.43.28.12
SSH_DEFAULT_PORT=22
SSH_DEFAULT_USER=root

# Authentication: password OR private key
SSH_DEFAULT_PASSWORD=your_password
# SSH_DEFAULT_PRIVATE_KEY_PATH=C:\Users\you\.ssh\id_ed25519
# SSH_DEFAULT_PASSPHRASE=
```

Or set them in PowerShell before starting Claude Code:

```powershell
$env:SSH_DEFAULT_NAME = "default"
$env:SSH_DEFAULT_HOST = "10.43.28.12"
$env:SSH_DEFAULT_PORT = "22022"
$env:SSH_DEFAULT_USER = "root"
$env:SSH_DEFAULT_PASSWORD = "your_password"

claude
```

### 2. Registering the MCP server in Claude Code

Done automatically by the one-click installer (Option 1). To register manually, add to `%USERPROFILE%\.mcp.json` (invoke node directly to avoid cmd escaping issues):

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

Enable it in `%USERPROFILE%\.claude\settings.local.json`:

```json
{
  "enabledMcpjsonServers": [
    "ssh-mcp-server"
  ]
}
```

After changing environment variables, `.mcp.json`, or rebuilding, **restart Claude Code**.

## Build & run

```powershell
pnpm run build
node dist/index.js
```

## Development

No build step needed — run directly with `tsx`:

```powershell
pnpm tsx src/index.ts
```

## Verification

After restarting Claude Code, try:

- "List all configured SSH hosts"
- "Run `whoami` on the default host"
- "Upload C:\tmp\test.txt to /tmp/test.txt on the remote host"
- "Download /var/log/syslog from the remote host to C:\tmp\syslog"
- "Add a new host 192.168.1.20 as root, named nas"
