#Requires -Version 5.1
<#
.SYNOPSIS
  ssh-mcp-server one-click installer (single-file bundle).

.DESCRIPTION
  Installs the prebuilt single-file bundle: copies (or downloads) index.mjs,
  creates a .env, registers the server in .mcp.json and enables it in
  settings.local.json. Idempotent — safe to re-run. Original config files
  are backed up to *.bak before modification.

  Two modes:
    1. Run from a cloned repo — uses the local dist/bundle/index.mjs.
    2. Run standalone (e.g. via iex from GitHub) — downloads the latest
       Release bundle from GitHub.

.EXAMPLE
  # Standalone install (no repo clone, no build):
  powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/HW-public/ssh-mcp-server/main/install.ps1'))"

.EXAMPLE
  # From a cloned repo:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
#>
param(
  [string]$InstallDir = $(if ($PSScriptRoot) { Join-Path $PSScriptRoot 'release' } else { Join-Path $env:USERPROFILE 'ssh-mcp-server' }),
  [string]$DownloadUrl = 'https://github.com/HW-public/ssh-mcp-server/releases/latest/download/index.mjs',
  [string]$EnvTemplateUrl = 'https://cdn.jsdelivr.net/gh/HW-public/ssh-mcp-server@main/.env.example',
  [string]$McpConfigPath = (Join-Path $env:USERPROFILE '.mcp.json'),
  [string]$SettingsPath = (Join-Path $env:USERPROFILE '.claude\settings.local.json')
)

$ErrorActionPreference = 'Stop'

function Write-JsonNoBom($path, $obj) {
  $json = $obj | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-JsonOrDefault($path, $defaultObj) {
  if (Test-Path $path) {
    $raw = Get-Content $path -Raw
    if ($raw -and $raw.Trim()) { return ($raw | ConvertFrom-Json) }
  }
  return $defaultObj
}

# --- 0. Preconditions ---------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js was not found on PATH. Install Node.js 20+ first: https://nodejs.org'
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$target = Join-Path $InstallDir 'index.mjs'

# --- 1. Obtain the single-file bundle ------------------------------------------
$localBundle = $(if ($PSScriptRoot) { Join-Path $PSScriptRoot 'dist\bundle\index.mjs' } else { $null })
if ($localBundle -and (Test-Path $localBundle)) {
  Copy-Item $localBundle $target -Force
  Write-Host "[ok] Copied index.mjs -> $InstallDir" -ForegroundColor Green
} else {
  Write-Host "[..] Downloading bundle from $DownloadUrl"
  Invoke-WebRequest -Uri $DownloadUrl -OutFile $target -UseBasicParsing
  Write-Host "[ok] Downloaded index.mjs -> $InstallDir" -ForegroundColor Green
}

# --- 2. .env ------------------------------------------------------------------
$envFile = Join-Path $InstallDir '.env'
if (-not (Test-Path $envFile)) {
  # Repo mode: prefer the project's real .env (carries actual credentials).
  $realEnv = $(if ($PSScriptRoot) { Join-Path $PSScriptRoot '.env' } else { $null })
  $created = $false
  if ($realEnv -and (Test-Path $realEnv)) {
    Copy-Item $realEnv $envFile
    Write-Host "[ok] Copied SSH credentials from project .env -> $envFile" -ForegroundColor Green
    $created = $true
  } else {
    # Standalone mode: fetch the template from the repo.
    try {
      Invoke-WebRequest -Uri $EnvTemplateUrl -OutFile $envFile -UseBasicParsing
      Write-Host "[ok] Created $envFile from template" -ForegroundColor Yellow
      $created = $true
    } catch {
      New-Item -ItemType File -Path $envFile | Out-Null
    }
  }
  if ($created) {
    Write-Host "     --> fill in your SSH credentials before restarting Claude Code" -ForegroundColor Yellow
  } else {
    Write-Host "[ok] Created empty $envFile -- fill in your SSH credentials" -ForegroundColor Yellow
  }
} else {
  Write-Host "[ok] .env already exists, kept as-is" -ForegroundColor Green
}

# --- 3. Register in .mcp.json --------------------------------------------------
$mcp = Read-JsonOrDefault $McpConfigPath ([pscustomobject]@{ mcpServers = [pscustomobject]@{} })
if (-not $mcp.mcpServers) {
  $mcp | Add-Member -Force -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{})
}

$entry = [pscustomobject]@{
  command = 'node'
  args    = @($target)
}

if (Test-Path $McpConfigPath) {
  Copy-Item $McpConfigPath "$McpConfigPath.bak" -Force
}

$servers = $mcp.mcpServers
$existing = $servers.PSObject.Properties['ssh-mcp-server']
if ($existing) {
  $existing.Value = $entry
} else {
  $servers | Add-Member -NotePropertyName 'ssh-mcp-server' -NotePropertyValue $entry
}

Write-JsonNoBom $McpConfigPath $mcp
Write-Host "[ok] Registered ssh-mcp-server in $McpConfigPath (backup: $McpConfigPath.bak)" -ForegroundColor Green

# --- 4. Enable in settings.local.json -------------------------------------------
$settings = Read-JsonOrDefault $SettingsPath ([pscustomobject]@{})
$enabled = @()
if ($settings.enabledMcpjsonServers) {
  $enabled = @($settings.enabledMcpjsonServers)
}

if ($enabled -notcontains 'ssh-mcp-server') {
  if (Test-Path $SettingsPath) {
    Copy-Item $SettingsPath "$SettingsPath.bak" -Force
  }
  $enabled += 'ssh-mcp-server'
  if ($settings.PSObject.Properties['enabledMcpjsonServers']) {
    $settings.enabledMcpjsonServers = $enabled
  } else {
    $settings | Add-Member -NotePropertyName enabledMcpjsonServers -NotePropertyValue $enabled
  }
  Write-JsonNoBom $SettingsPath $settings
  Write-Host "[ok] Enabled ssh-mcp-server in $SettingsPath" -ForegroundColor Green
} else {
  Write-Host "[ok] ssh-mcp-server already enabled in settings" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Fill in $envFile (if you haven't), then restart Claude Code." -ForegroundColor Cyan
