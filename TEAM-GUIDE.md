# MCP-Expose Team Guide

## Cài đặt

### Windows
```powershell
# Mở PowerShell và chạy:
powershell -ExecutionPolicy Bypass -File setup.ps1
```
Hoặc double-click file `setup.bat`

### Mac/Linux
```bash
curl -fsSL https://raw.githubusercontent.com/gianglolo12/mcp-expose/main/install.sh | bash
```

## Cấu hình project

**Bước 1:** Tạo file `.mcp.json` trong thư mục project của bạn:

```json
{
  "mcpServers": {
    "mcp-expose": {
      "command": "node",
      "args": ["~/.mcp-expose/dist/index.js"],
      "cwd": "/đường/dẫn/đến/project/của/bạn"
    }
  }
}
```

**Bước 2:** Tạo file `mcp-expose.yaml` trong thư mục project:

```yaml
name: ten-cua-ban
port: 8789

tools:
  - name: build
    description: "Build project"
    handler:
      type: shell
      command: "npm run build"

  - name: test
    description: "Run tests"
    handler:
      type: shell
      command: "npm test"

  - name: git_status
    description: "Show git status"
    handler:
      type: shell
      command: "git status"
```

**Bước 3:** Restart Claude Code

## Sử dụng

### Kết nối relay server
```
connect("ten-cua-ban")
```
Relay server: `ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws`

### Xem ai đang online
```
list_peers()
```

### Hỏi peer khác (Claude của họ sẽ trả lời)
```
ask_peer("alice", "Requirement của feature login là gì?")
```

### Xem tools của peer
```
list_peer_tools("alice")
```

### Gọi tool của peer
```
call_peer_tool("alice", "build", {})
```

### Ngắt kết nối
```
disconnect()
```

## Lưu ý

1. **Phải mở Claude Code** để nhận request từ peer khác
2. **Mỗi project dùng port khác nhau** nếu muốn expose nhiều peer trên 1 máy
3. Timeout: `ask_peer` = 60s, `call_peer_tool` = 120s

## Ví dụ workflow

**PO (alice):**
```yaml
# mcp-expose.yaml
name: alice-po
port: 8789
tools:
  - name: get_prd
    description: "Get PRD document"
    handler:
      type: shell
      command: "cat docs/prd.md"
```

**Dev (bob):**
```yaml
# mcp-expose.yaml  
name: bob-dev
port: 8790
tools:
  - name: build
    description: "Build project"
    handler:
      type: shell
      command: "npm run build"
```

**QC (charlie):**
```yaml
# mcp-expose.yaml
name: charlie-qc
port: 8791
tools:
  - name: run_tests
    description: "Run test suite"
    handler:
      type: shell
      command: "npm test"
```

Sau khi tất cả connect:
- Bob: `ask_peer("alice", "Specs của feature login?")` → Alice's Claude trả lời
- Bob: `call_peer_tool("charlie", "run_tests", {})` → Chạy tests trên máy Charlie
