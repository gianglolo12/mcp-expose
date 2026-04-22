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
set CLAUDE_DIR=%USERPROFILE%\.claude
set SETTINGS_FILE=%CLAUDE_DIR%\settings.json

echo [1/4] Installing to %INSTALL_DIR%...

:: Clone or update repo
if exist "%INSTALL_DIR%" (
    echo Updating existing installation...
    cd /d "%INSTALL_DIR%"
    git pull
) else (
    git clone https://github.com/gianglolo12/mcp-expose.git "%INSTALL_DIR%"
    cd /d "%INSTALL_DIR%"
)

echo [2/4] Installing dependencies...
call npm install

echo [3/4] Building...
call npm run build

echo [4/4] Configuring Claude Code...

:: Create .claude directory if needed
if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%"

:: Create or update settings.json
if exist "%SETTINGS_FILE%" (
    :: Backup existing settings
    copy "%SETTINGS_FILE%" "%SETTINGS_FILE%.backup" >nul

    :: Use Node to merge settings
    node -e "const fs=require('fs');const p='%SETTINGS_FILE%'.replace(/\\/g,'/');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.mcpServers=s.mcpServers||{};s.mcpServers['mcp-expose']={command:'node',args:['%INSTALL_DIR%\\dist\\index.js'.replace(/\\/g,'/')]};fs.writeFileSync(p,JSON.stringify(s,null,2));"
) else (
    :: Create new settings file
    echo {> "%SETTINGS_FILE%"
    echo   "mcpServers": {>> "%SETTINGS_FILE%"
    echo     "mcp-expose": {>> "%SETTINGS_FILE%"
    echo       "command": "node",>> "%SETTINGS_FILE%"
    echo       "args": ["%INSTALL_DIR:\=/%/dist/index.js"]>> "%SETTINGS_FILE%"
    echo     }>> "%SETTINGS_FILE%"
    echo   }>> "%SETTINGS_FILE%"
    echo }>> "%SETTINGS_FILE%"
)

echo.
echo ============================================
echo   Installation Complete!
echo ============================================
echo.
echo Next steps:
echo   1. Restart Claude Code
echo   2. Type: connect("your-name")
echo.
echo Relay server: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws
echo.
pause
