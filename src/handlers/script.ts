import { resolve } from "path";

export async function handleScript(
  handlerPath: string,
  params: Record<string, unknown>
): Promise<string> {
  const absPath = resolve(process.cwd(), handlerPath);

  try {
    const mod = await import(absPath);
    const handler = mod.default ?? mod.handler;

    if (typeof handler !== "function") {
      return JSON.stringify({
        status: "error",
        message: `Script ${handlerPath} does not export a default function or 'handler' function`,
      });
    }

    const result = await handler(params);
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({
      status: "error",
      message: `Failed to run script ${handlerPath}: ${err}`,
    });
  }
}
