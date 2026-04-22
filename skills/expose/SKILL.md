---
name: expose
description: Show the status and configuration of the mcp-expose server. Use when the user asks about exposed MCP tools, server status, or wants to check connections.
---

# mcp-expose Status

Check the status of your exposed MCP server by calling the `expose_status` tool.

## Available built-in tools

**Status & Config:**
- `expose_status` — Show server status, port, tools, tunnel, and users
- `expose_history` — Show recent run history
- `expose_config` — Show current configuration
- `expose_scan` — Scan project to help generate config

**Tunnel (ngrok):**
- `openport` — Open a public ngrok tunnel
- `closeport` — Close the ngrok tunnel

**Multi-tenant Users:**
- `create_user` — Create a new user with unique MCP endpoints
- `list_users` — List all registered users
- `delete_user` — Delete a user and revoke access

## Quick start

1. Run `/init` skill to interactively create `mcp-expose.yaml`
2. Restart Claude Code — the plugin auto-starts the HTTP server
3. Use `openport` to expose via ngrok
4. Use `create_user` to generate unique URLs for each person

## Multi-tenant URLs

Each user gets their own endpoints:
```
https://your-ngrok.io/u/{userId}/sse
https://your-ngrok.io/u/{userId}/mcp
```
