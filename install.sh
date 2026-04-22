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

SETTINGS_FILE="$CLAUDE_DIR/settings.json"
INSTALL_DIR="$HOME/.mcp-expose"

# Step 1: Clone or update repo
echo -e "${YELLOW}[1/4]${NC} Installing mcp-expose to $INSTALL_DIR..."
if [ -d "$INSTALL_DIR" ]; then
  echo "  Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --quiet
else
  git clone --quiet https://github.com/user/mcp-expose.git "$INSTALL_DIR" 2>/dev/null || {
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
echo -e "${YELLOW}[2/4]${NC} Installing dependencies..."
cd "$INSTALL_DIR"
npm install --silent
npm run build --silent

# Step 3: Create Claude settings directory if needed
echo -e "${YELLOW}[3/4]${NC} Configuring Claude Code..."
mkdir -p "$CLAUDE_DIR"

# Step 4: Add to settings.json
if [ -f "$SETTINGS_FILE" ]; then
  # Check if already installed
  if grep -q "mcp-expose" "$SETTINGS_FILE" 2>/dev/null; then
    echo "  mcp-expose already in settings, updating path..."
  fi

  # Use node to safely merge JSON
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
    settings.mcpServers = settings.mcpServers || {};
    settings.mcpServers['mcp-expose'] = {
      command: 'node',
      args: ['$INSTALL_DIR/dist/index.js']
    };
    fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
  "
else
  # Create new settings file
  cat > "$SETTINGS_FILE" << EOF
{
  "mcpServers": {
    "mcp-expose": {
      "command": "node",
      "args": ["$INSTALL_DIR/dist/index.js"]
    }
  }
}
EOF
fi

echo -e "${YELLOW}[4/4]${NC} Done!"
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ mcp-expose installed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "  ${BLUE}Next steps:${NC}"
echo -e "  1. Restart Claude Code"
echo -e "  2. In your project, say: ${YELLOW}\"init mcp-expose\"${NC}"
echo -e "  3. Claude will help you create mcp-expose.yaml"
echo
echo -e "  ${BLUE}Installed to:${NC} $INSTALL_DIR"
echo -e "  ${BLUE}Settings:${NC} $SETTINGS_FILE"
echo
