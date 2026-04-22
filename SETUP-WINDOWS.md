# MCP-Expose Setup Guide (Windows)

## Yêu cầu

- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)
- [Claude Code](https://claude.ai/code)

---

## Cài đặt

Mở **Command Prompt** hoặc **PowerShell** và chạy:

```cmd
git clone https://github.com/gianglolo12/mcp-expose.git %USERPROFILE%\.mcp-expose
cd %USERPROFILE%\.mcp-expose
npm install
npm run build
```

---

## Cấu hình Project

### Bước 1: Tạo file `.mcp.json`

Vào thư mục project của bạn, tạo file `.mcp.json`:

```json
{
  "mcpServers": {
    "mcp-expose": {
      "command": "node",
      "args": ["C:/Users/TEN_USER/.mcp-expose/dist/index.js"]
    }
  }
}
```

> ⚠️ Thay `TEN_USER` bằng username Windows của bạn (ví dụ: `C:/Users/giang/.mcp-expose/dist/index.js`)

### Bước 2: Tạo file `mcp-expose.yaml`

Tạo file `mcp-expose.yaml` trong thư mục project:

```yaml
name: ten-cua-ban
port: 8789

tools:
  - name: git_status
    description: "Xem git status"
    handler:
      type: shell
      command: "git status"

  - name: git_log
    description: "Xem commits gần nhất"
    handler:
      type: shell
      command: "git log --oneline -10"

  - name: build
    description: "Build project"
    handler:
      type: shell
      command: "npm run build"

  - name: test
    description: "Chạy tests"
    handler:
      type: shell
      command: "npm test"
```

> 💡 Đổi `ten-cua-ban` thành tên của bạn (ví dụ: `giang`, `alice`, `bob`)

### Bước 3: Restart Claude Code

Tắt và mở lại Claude Code để load plugin.

---

## Sử dụng

### Kết nối relay server

```
connect("ten-cua-ban")
```

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

---

## Lưu ý

| Lưu ý | Giải thích |
|-------|------------|
| Phải mở Claude Code | Để nhận request từ peer khác, Claude Code phải đang chạy |
| Port khác nhau | Nếu chạy nhiều peer trên 1 máy, mỗi project dùng port khác (8789, 8790, ...) |
| Timeout | `ask_peer`: 60s, `call_peer_tool`: 120s |

---

## Relay Server

```
ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws
```

---

## Troubleshooting

### Plugin không load

1. Kiểm tra đường dẫn trong `.mcp.json` đúng chưa
2. Đảm bảo đã chạy `npm run build`
3. Restart Claude Code

### Port đang bị chiếm

Đổi port trong `mcp-expose.yaml`:

```yaml
port: 8790  # Thay số khác
```

### ask_peer báo lỗi

1. Kiểm tra peer đã `connect()` chưa bằng `list_peers()`
2. Đảm bảo peer đang mở Claude Code

---

## Ví dụ Workflow Team

**PO (alice) - port 8789:**
```yaml
name: alice
port: 8789
tools:
  - name: get_prd
    description: "Lấy PRD"
    handler:
      type: shell
      command: "cat docs/prd.md"
```

**Dev (bob) - port 8790:**
```yaml
name: bob
port: 8790
tools:
  - name: build
    description: "Build project"
    handler:
      type: shell
      command: "npm run build"
```

**QC (charlie) - port 8791:**
```yaml
name: charlie
port: 8791
tools:
  - name: run_tests
    description: "Chạy tests"
    handler:
      type: shell
      command: "npm test"
```

Sau khi tất cả connect:
- Bob hỏi Alice: `ask_peer("alice", "Specs của feature login?")`
- Bob gọi tool Charlie: `call_peer_tool("charlie", "run_tests", {})`
