---
name: init
description: Initialize mcp-expose by having an interactive conversation with the user to understand what they want to expose, then generate mcp-expose.yaml
---

# Initialize mcp-expose

You are helping the user set up mcp-expose to expose their project as an MCP server that others can connect to remotely.

## Your workflow

### Step 1: Explore the project
First, silently scan the project to understand what's available:
- Read `package.json` for npm scripts
- Check for `Makefile`
- Look for `scripts/`, `bin/` directories
- Note the project type (Node.js, Python, Go, etc.)

### Step 2: Ask the user
Based on your findings, ask the user what they want to expose. Be conversational:

Example questions:
- "Tôi thấy project này có các npm scripts: build, test, dev, lint. Bạn muốn expose những cái nào cho người khác dùng?"
- "Bạn có muốn expose thêm commands như git status, search code không?"
- "Có tool nào đặc biệt bạn muốn thêm không?"

Keep asking until you have enough info. Don't overwhelm - 2-3 questions max.

### Step 3: Generate config
Create `mcp-expose.yaml` with the user's choices.

## Config format

```yaml
name: <project-name>
port: 8788
host: 0.0.0.0

tools:
  - name: <tool-name>
    description: "<what it does>"
    handler:
      type: shell
      command: "<command>"

  # Tool with parameters
  - name: search
    description: "Search code in project"
    params:
      query:
        type: string
        required: true
        description: "Search query"
    handler:
      type: shell
      command: "grep -r '{query}' --include='*.ts' ."
```

## Handler types

| Type | Use for |
|------|---------|
| `shell` | Shell commands (npm run, make, grep, etc.) |
| `script` | Run a script file |
| `claude-cli` | Complex tasks needing AI (code review, refactor) |

## After generating

Tell the user:
1. Config đã được tạo tại `mcp-expose.yaml`
2. Restart Claude Code để server tự khởi động
3. Dùng `openport` để expose ra internet qua ngrok
4. Dùng `create_user` để tạo URL riêng cho từng người

## Important
- Be conversational in Vietnamese
- Don't assume - ask the user
- Start simple, user can add more later
