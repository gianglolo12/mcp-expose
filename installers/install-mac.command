#!/bin/bash
# MCP-Expose Installer for Mac
# Double-click to run or: chmod +x install-mac.command && ./install-mac.command

cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MCP-Expose Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check dependencies
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa cài. Tải tại: https://nodejs.org/"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git chưa cài. Tải tại: https://git-scm.com/"
    read -p "Nhấn Enter để thoát..."
    exit 1
fi

INSTALL_DIR="$HOME/.mcp-expose"

echo "[1/2] Đang cài đặt..."
if [ -d "$INSTALL_DIR" ]; then
    cd "$INSTALL_DIR" && git pull --quiet
else
    git clone --quiet https://github.com/gianglolo12/mcp-expose.git "$INSTALL_DIR"
fi

echo "[2/2] Đang build..."
cd "$INSTALL_DIR"
npm install --silent 2>/dev/null
npm run build --silent 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Cài đặt thành công!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Tiếp theo:"
echo "  1. Vào thư mục project của bạn"
echo "  2. Tạo file .mcp.json:"
echo ""
echo '     {'
echo '       "mcpServers": {'
echo '         "mcp-expose": {'
echo '           "command": "node",'
echo "           \"args\": [\"$INSTALL_DIR/dist/index.js\"]"
echo '         }'
echo '       }'
echo '     }'
echo ""
echo "  3. Tạo file mcp-expose.yaml"
echo "  4. Restart Claude Code"
echo "  5. Gõ: connect(\"ten-cua-ban\")"
echo ""
echo "Relay: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws"
echo ""
read -p "Nhấn Enter để thoát..."
