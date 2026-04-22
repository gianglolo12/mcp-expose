@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   MCP-Expose Installer
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo X Node.js chua cai. Tai tai: https://nodejs.org/
    pause
    exit /b 1
)

:: Check Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo X Git chua cai. Tai tai: https://git-scm.com/
    pause
    exit /b 1
)

set INSTALL_DIR=%USERPROFILE%\.mcp-expose

echo [1/2] Dang cai dat...
if exist "%INSTALL_DIR%" (
    cd /d "%INSTALL_DIR%"
    git pull -q
) else (
    git clone -q https://github.com/gianglolo12/mcp-expose.git "%INSTALL_DIR%"
)

echo [2/2] Dang build...
cd /d "%INSTALL_DIR%"
call npm install --silent 2>nul
call npm run build --silent 2>nul

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   V Cai dat thanh cong!
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo Tiep theo:
echo   1. Vao thu muc project cua ban
echo   2. Tao file .mcp.json:
echo.
echo      {
echo        "mcpServers": {
echo          "mcp-expose": {
echo            "command": "node",
echo            "args": ["%INSTALL_DIR:\=/%/dist/index.js"]
echo          }
echo        }
echo      }
echo.
echo   3. Tao file mcp-expose.yaml
echo   4. Restart Claude Code
echo   5. Go: connect("ten-cua-ban")
echo.
echo Relay: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws
echo.
pause
