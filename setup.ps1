# MCP-Expose Installer for Windows (PowerShell)
# Run: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MCP-Expose Installer for Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git not found. Please install from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

$INSTALL_DIR = "$env:USERPROFILE\.mcp-expose"
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$SETTINGS_FILE = "$CLAUDE_DIR\settings.json"

Write-Host "[1/4] Installing to $INSTALL_DIR..." -ForegroundColor Yellow

# Clone or update repo
if (Test-Path $INSTALL_DIR) {
    Write-Host "  Updating existing installation..."
    Set-Location $INSTALL_DIR
    git pull
} else {
    git clone https://github.com/gianglolo12/mcp-expose.git $INSTALL_DIR
    Set-Location $INSTALL_DIR
}

Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "[3/4] Building..." -ForegroundColor Yellow
npm run build

Write-Host "[4/4] Configuring Claude Code..." -ForegroundColor Yellow

# Create .claude directory if needed
if (-not (Test-Path $CLAUDE_DIR)) {
    New-Item -ItemType Directory -Path $CLAUDE_DIR | Out-Null
}

# Prepare the args path with forward slashes
$argsPath = "$INSTALL_DIR\dist\index.js" -replace '\\', '/'

# Create or update settings.json
if (Test-Path $SETTINGS_FILE) {
    # Backup existing settings
    Copy-Item $SETTINGS_FILE "$SETTINGS_FILE.backup"

    # Read and update settings
    $settings = Get-Content $SETTINGS_FILE -Raw | ConvertFrom-Json
    if (-not $settings.mcpServers) {
        $settings | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue @{}
    }
    $settings.mcpServers | Add-Member -NotePropertyName "mcp-expose" -NotePropertyValue @{
        command = "node"
        args = @($argsPath)
    } -Force
    $settings | ConvertTo-Json -Depth 10 | Set-Content $SETTINGS_FILE
} else {
    # Create new settings file
    $settings = @{
        mcpServers = @{
            "mcp-expose" = @{
                command = "node"
                args = @($argsPath)
            }
        }
    }
    $settings | ConvertTo-Json -Depth 10 | Set-Content $SETTINGS_FILE
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host '  1. Restart Claude Code' -ForegroundColor White
Write-Host '  2. Type: connect("your-name")' -ForegroundColor White
Write-Host ""
Write-Host "Relay server: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
