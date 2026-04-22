MCP-EXPOSE INSTALLER
====================

CÁCH CÀI ĐẶT:

Mac:
  - Double-click file "install-mac.command"
  - Hoặc mở Terminal: chmod +x install-mac.command && ./install-mac.command

Windows:
  - Double-click file "install-win.bat"


SAU KHI CÀI:

1. Copy file "mcp.json.template" vào thư mục project
2. Đổi tên thành ".mcp.json"
3. Copy file "mcp-expose.yaml.template" vào thư mục project
4. Đổi tên thành "mcp-expose.yaml"
5. Sửa "ten-cua-ban" trong file yaml thành tên của bạn
6. Restart Claude Code
7. Gõ: connect("ten-cua-ban")


XEM AI ĐANG ONLINE:
  list_peers()

HỎI PEER KHÁC:
  ask_peer("alice", "Requirement là gì?")

GỌI TOOL CỦA PEER:
  call_peer_tool("alice", "build", {})


RELAY SERVER: ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws
