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

Write-Host "[1/3] Installing to $INSTALL_DIR..." -ForegroundColor Yellow

# Clone or update repo
if (Test-Path $INSTALL_DIR) {
    Write-Host "  Updating existing installation..."
    Set-Location $INSTALL_DIR
    git pull
} else {
    git clone https://github.com/gianglolo12/mcp-expose.git $INSTALL_DIR
    Set-Location $INSTALL_DIR
}

Write-Host "[2/3] Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "[3/3] Building..." -ForegroundColor Yellow
npm run build

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Go to your project directory" -ForegroundColor White
Write-Host "  2. Create .mcp.json:" -ForegroundColor White
Write-Host ""
Write-Host '     {' -ForegroundColor Gray
Write-Host '       "mcpServers": {' -ForegroundColor Gray
Write-Host '         "mcp-expose": {' -ForegroundColor Gray
Write-Host '           "command": "node",' -ForegroundColor Gray
Write-Host '           "args": ["~/.mcp-expose/dist/index.js"]' -ForegroundColor Gray
Write-Host '         }' -ForegroundColor Gray
Write-Host '       }' -ForegroundColor Gray
Write-Host '     }' -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Create mcp-expose.yaml with your tools" -ForegroundColor White
Write-Host "  4. Restart Claude Code" -ForegroundColor White
Write-Host '  5. Run: connect("your-name")' -ForegroundColor White
Write-Host ""
Write-Host "Installed to: $INSTALL_DIR" -ForegroundColor Cyan
Write-Host "Relay server: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
