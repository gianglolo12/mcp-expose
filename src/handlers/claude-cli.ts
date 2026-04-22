import { spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { v4 as uuidv4 } from "uuid";
import { addHistoryEntry, updateHistoryEntry, writeLog } from "../history.js";

interface ClaudeCliOptions {
  prompt: string;
  model: string;
  cwd?: string;
  allowedTools?: string[];
  mcpServers?: string[];
}

function resolveClaudeCliPath(): string {
  const home = homedir();
  const candidates = [
    `${home}/.local/bin/claude`,
    `${home}/.cargo/bin/claude`,
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "claude";
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

export async function handleClaudeCli(
  options: ClaudeCliOptions,
  params: Record<string, unknown>
): Promise<string> {
  const runId = uuidv4();
  const startedAt = new Date().toISOString();
  const prompt = interpolate(options.prompt, params);

  addHistoryEntry({
    id: runId,
    toolName: "claude-cli",
    status: "running",
    startedAt,
    finishedAt: null,
    durationMs: null,
    params,
  });

  const cliPath = resolveClaudeCliPath();
  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--model", options.model,
    "--dangerously-skip-permissions",
  ];

  // Build allowed tools
  const allTools = [...(options.allowedTools ?? [])];
  for (const mcp of options.mcpServers ?? []) {
    allTools.push(`mcp__${mcp}__*`);
  }
  if (allTools.length > 0) {
    args.push("--allowedTools", allTools.join(","));
  }

  // Extend PATH
  const home = homedir();
  const extendedPath = `${home}/.local/bin:${home}/.cargo/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}`;

  const child = spawn(cliPath, args, {
    cwd: options.cwd || undefined,
    env: { ...process.env, PATH: extendedPath },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let fullLog = "";
  child.stdout?.on("data", (chunk: Buffer) => { fullLog += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { fullLog += `[stderr] ${chunk.toString()}`; });

  child.on("close", (code) => {
    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    writeLog(runId, fullLog);
    updateHistoryEntry(runId, {
      status: code === 0 ? "success" : "failed",
      finishedAt,
      durationMs,
    });
  });

  return JSON.stringify({
    runId,
    status: "running",
    message: `Claude CLI spawned. Use expose_history or get_status to check progress.`,
  });
}
