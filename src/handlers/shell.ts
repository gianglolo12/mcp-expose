import { exec } from "child_process";

interface ShellOptions {
  command: string;
  cwd?: string;
}

function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];
    if (val === undefined) return `{${key}}`;
    // Escape shell special chars to prevent injection
    return String(val).replace(/[;&|`$(){}]/g, "\\$&");
  });
}

export async function handleShell(
  options: ShellOptions,
  params: Record<string, unknown>
): Promise<string> {
  const command = interpolate(options.command, params);

  return new Promise((resolve) => {
    exec(command, { cwd: options.cwd || undefined, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(JSON.stringify({
          status: "error",
          exitCode: err.code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        }));
      } else {
        resolve(stdout.trim() || stderr.trim() || "(no output)");
      }
    });
  });
}
