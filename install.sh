#!/bin/bash

# mcp-expose installer
# Usage: curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  mcp-expose installer${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin*) CLAUDE_DIR="$HOME/.claude" ;;
  Linux*)  CLAUDE_DIR="$HOME/.claude" ;;
  MINGW*|MSYS*|CYGWIN*) CLAUDE_DIR="$USERPROFILE/.claude" ;;
  *) echo -e "${RED}Unsupported OS: $OS${NC}"; exit 1 ;;
esac

INSTALL_DIR="$HOME/.mcp-expose"

# Step 1: Clone or update repo
echo -e "${YELLOW}[1/3]${NC} Installing mcp-expose to $INSTALL_DIR..."
if [ -d "$INSTALL_DIR" ]; then
  echo "  Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  git clone --quiet https://github.com/gianglolo12/mcp-expose.git "$INSTALL_DIR" 2>/dev/null || {
    # If no git repo, copy current directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$SCRIPT_DIR/package.json" ]; then
      echo "  Copying from local directory..."
      mkdir -p "$INSTALL_DIR"
      cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
    else
      echo -e "${RED}Error: Could not find mcp-expose source${NC}"
      exit 1
    fi
  }
fi

# Step 2: Install dependencies and build
echo -e "${YELLOW}[2/3]${NC} Installing dependencies..."
cd "$INSTALL_DIR"
npm install --silent
npm run build --silent

echo -e "${YELLOW}[3/3]${NC} Done!"
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ mcp-expose installed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "  ${BLUE}Next steps:${NC}"
echo -e "  1. Go to your project directory"
echo -e "  2. Create ${YELLOW}.mcp.json${NC}:"
echo
cat << 'MCPJSON'
     {
       "mcpServers": {
         "mcp-expose": {
           "command": "node",
           "args": ["~/.mcp-expose/dist/index.js"]
         }
       }
     }
MCPJSON
echo
echo -e "  3. Create ${YELLOW}mcp-expose.yaml${NC} with your tools"
echo -e "  4. Restart Claude Code"
echo -e "  5. Run: ${YELLOW}connect(\"your-name\")${NC}"
echo
echo -e "  ${BLUE}Installed to:${NC} $INSTALL_DIR"
echo -e "  ${BLUE}Relay server:${NC} ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws"
echo
