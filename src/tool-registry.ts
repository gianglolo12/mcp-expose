import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodRawShape } from "zod";
import type { ToolConfig, ParamConfig } from "./config.js";
import { handleClaudeCli } from "./handlers/claude-cli.js";
import { handleShell } from "./handlers/shell.js";
import { handleScript } from "./handlers/script.js";

function buildZodSchema(params?: Record<string, ParamConfig>): ZodRawShape {
  if (!params) return {};

  const shape: ZodRawShape = {};
  for (const [key, config] of Object.entries(params)) {
    let schema: z.ZodTypeAny;

    switch (config.type) {
      case "number":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      default:
        schema = z.string();
    }

    if (config.description) {
      schema = schema.describe(config.description);
    }

    if (!config.required) {
      schema = schema.optional();
    }

    shape[key] = schema;
  }

  return shape;
}

export async function dispatch(
  tool: ToolConfig,
  params: Record<string, unknown>
): Promise<string> {
  const handler = tool.handler;

  switch (handler.type) {
    case "claude-cli":
      return handleClaudeCli(
        {
          prompt: handler.prompt,
          model: handler.model,
          cwd: handler.cwd,
          allowedTools: handler.allowedTools,
          mcpServers: handler.mcpServers,
        },
        params
      );

    case "shell":
      return handleShell(
        { command: handler.command, cwd: handler.cwd },
        params
      );

    case "script":
      return handleScript(handler.path, params);

    default:
      return JSON.stringify({ error: "Unknown handler type" });
  }
}

export function registerTools(server: McpServer, tools: ToolConfig[]) {
  for (const tool of tools) {
    const zodShape = buildZodSchema(tool.params);

    server.tool(
      tool.name,
      tool.description,
      zodShape,
      async (args: Record<string, unknown>) => {
        const result = await dispatch(tool, args);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      }
    );
  }
}
