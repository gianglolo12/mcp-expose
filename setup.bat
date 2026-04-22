@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   MCP-Expose Installer for Windows
echo ============================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)

:: Check Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git not found. Please install from https://git-scm.com/
    pause
    exit /b 1
)

set INSTALL_DIR=%USERPROFILE%\.mcp-expose

echo [1/3] Installing to %INSTALL_DIR%...

:: Clone or update repo
if exist "%INSTALL_DIR%" (
    echo Updating existing installation...
    cd /d "%INSTALL_DIR%"
    git pull
) else (
    git clone https://github.com/gianglolo12/mcp-expose.git "%INSTALL_DIR%"
    cd /d "%INSTALL_DIR%"
)

echo [2/3] Installing dependencies...
call npm install

echo [3/3] Building...
call npm run build

echo.
echo ============================================
echo   Installation Complete!
echo ============================================
echo.
echo Next steps:
echo   1. Go to your project directory
echo   2. Create .mcp.json:
echo.
echo      {
echo        "mcpServers": {
echo          "mcp-expose": {
echo            "command": "node",
echo            "args": ["~/.mcp-expose/dist/index.js"]
echo          }
echo        }
echo      }
echo.
echo   3. Create mcp-expose.yaml with your tools
echo   4. Restart Claude Code
echo   5. Run: connect("your-name")
echo.
echo Installed to: %INSTALL_DIR%
echo Relay server: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws
echo.
pause
