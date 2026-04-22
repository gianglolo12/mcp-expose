#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const INSTALL_DIR = join(homedir(), ".mcp-expose");
const RELAY_URL = "ws://giangnnt-mcp-dtsdt0-8ad715-103-245-255-47.traefik.me/ws";

console.log("\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
console.log("\x1b[36m  MCP-Expose Setup\x1b[0m");
console.log("\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");

// Step 1: Clone/update repo
console.log("\x1b[33m[1/2]\x1b[0m Installing...");
if (existsSync(INSTALL_DIR)) {
  execSync("git pull", { cwd: INSTALL_DIR, stdio: "inherit" });
} else {
  execSync(`git clone https://github.com/gianglolo12/mcp-expose.git "${INSTALL_DIR}"`, { stdio: "inherit" });
}

// Step 2: Install & build
console.log("\x1b[33m[2/2]\x1b[0m Building...");
execSync("npm install --silent && npm run build --silent", { cwd: INSTALL_DIR, stdio: "inherit" });

// Done
console.log("\n\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
console.log("\x1b[32m  ✓ Installed!\x1b[0m");
console.log("\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");

console.log("Add to your project's \x1b[33m.mcp.json\x1b[0m:\n");
console.log(`  {
    "mcpServers": {
      "mcp-expose": {
        "command": "node",
        "args": ["${INSTALL_DIR}/dist/index.js"]
      }
    }
  }\n`);

console.log("Then create \x1b[33mmcp-expose.yaml\x1b[0m and restart Claude Code.");
console.log(`Relay: \x1b[36m${RELAY_URL}\x1b[0m\n`);
