#!/bin/bash

# Build pre-configured mcp-expose package for your team
# Usage: ./build-package.sh wss://your-relay-server.com/ws

set -e

RELAY_URL="$1"

if [ -z "$RELAY_URL" ]; then
  echo "Usage: ./build-package.sh <relay-server-url>"
  echo "Example: ./build-package.sh wss://mcp.yourdomain.com/ws"
  exit 1
fi

echo "Building mcp-expose package with relay: $RELAY_URL"

# Update relay-config.json
cat > relay-config.json << EOF
{
  "relayServer": "$RELAY_URL",
  "name": "MCP Relay Hub",
  "version": "1.0.0"
}
EOF

# Build TypeScript
npm run build

# Create distributable package
PACKAGE_DIR="dist-package"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy necessary files
cp -r dist "$PACKAGE_DIR/"
cp package.json "$PACKAGE_DIR/"
cp relay-config.json "$PACKAGE_DIR/"

# Create simplified install script for end users
cat > "$PACKAGE_DIR/install.sh" << 'INSTALL_EOF'
#!/bin/bash
set -e

INSTALL_DIR="$HOME/.mcp-expose"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "Installing mcp-expose..."

# Copy files
mkdir -p "$INSTALL_DIR"
cp -r "$(dirname "$0")"/* "$INSTALL_DIR/"

# Install dependencies
cd "$INSTALL_DIR"
npm install --production --silent

# Add to Claude Code settings
mkdir -p "$(dirname "$CLAUDE_SETTINGS")"

if [ -f "$CLAUDE_SETTINGS" ]; then
  node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));
    settings.mcpServers = settings.mcpServers || {};
    settings.mcpServers['mcp-expose'] = {
      command: 'node',
      args: ['$INSTALL_DIR/dist/index.js']
    };
    fs.writeFileSync('$CLAUDE_SETTINGS', JSON.stringify(settings, null, 2));
  "
else
  cat > "$CLAUDE_SETTINGS" << EOF
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

RELAY_URL=$(node -e "console.log(require('$INSTALL_DIR/relay-config.json').relayServer || 'not configured')")

echo ""
echo "✓ mcp-expose installed!"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code"
echo "  2. Say: connect(\"your-name\")"
echo ""
echo "Relay server: $RELAY_URL"
INSTALL_EOF

chmod +x "$PACKAGE_DIR/install.sh"

# Create zip for distribution
ZIP_NAME="mcp-expose-package.zip"
rm -f "$ZIP_NAME"
cd "$PACKAGE_DIR" && zip -r "../$ZIP_NAME" . && cd ..

echo ""
echo "✓ Package built successfully!"
echo ""
echo "Files:"
echo "  - $PACKAGE_DIR/ (directory)"
echo "  - $ZIP_NAME (for distribution)"
echo ""
echo "Share the zip with your team. They run:"
echo "  unzip mcp-expose-package.zip -d mcp-expose && cd mcp-expose && ./install.sh"
