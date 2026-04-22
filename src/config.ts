import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// --- Zod schemas ---

const ParamSchema = z.object({
  type: z.enum(["string", "number", "boolean"]).default("string"),
  required: z.boolean().default(false),
  description: z.string().optional(),
});

const ClaudeCliHandlerSchema = z.object({
  type: z.literal("claude-cli"),
  prompt: z.string(),
  model: z.string().default("claude-sonnet-4-6"),
  cwd: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
});

const ShellHandlerSchema = z.object({
  type: z.literal("shell"),
  command: z.string(),
  cwd: z.string().optional(),
});

const ScriptHandlerSchema = z.object({
  type: z.literal("script"),
  path: z.string(),
});

const HandlerSchema = z.discriminatedUnion("type", [
  ClaudeCliHandlerSchema,
  ShellHandlerSchema,
  ScriptHandlerSchema,
]);

const ToolConfigSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, "Tool name must be snake_case"),
  description: z.string(),
  params: z.record(z.string(), ParamSchema).optional(),
  handler: HandlerSchema,
});

const ServerConfigSchema = z.object({
  name: z.string().default("mcp-expose"),
  port: z.number().int().min(1).max(65535).default(8787),
  host: z.string().default("0.0.0.0"),
  tools: z.array(ToolConfigSchema).min(1, "At least one tool is required"),
});

export type ParamConfig = z.infer<typeof ParamSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type HandlerConfig = z.infer<typeof HandlerSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// --- Config loader ---

const CONFIG_FILENAMES = ["mcp-expose.yaml", "mcp-expose.yml"];

function findConfigFile(): string | null {
  // 1. Current working directory
  for (const name of CONFIG_FILENAMES) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) return p;
  }

  // 2. Home config directory
  const homeConfig = join(homedir(), ".config", "mcp-expose");
  for (const name of CONFIG_FILENAMES) {
    const p = join(homeConfig, name.replace("mcp-expose", "config"));
    if (existsSync(p)) return p;
  }
  for (const name of CONFIG_FILENAMES) {
    const p = join(homeConfig, name);
    if (existsSync(p)) return p;
  }

  return null;
}

export function loadConfig(explicitPath?: string): ServerConfig {
  const configPath = explicitPath ?? findConfigFile();

  if (!configPath) {
    throw new Error(
      "No mcp-expose.yaml found. Searched:\n" +
        `  - ${join(process.cwd(), "mcp-expose.yaml")}\n` +
        `  - ${join(homedir(), ".config", "mcp-expose", "config.yaml")}\n` +
        "Create one with your tool definitions."
    );
  }

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseYaml(raw);
  const result = ServerConfigSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config (${configPath}):\n${errors}`);
  }

  return result.data;
}

export function getConfigPath(): string | null {
  return findConfigFile();
}
