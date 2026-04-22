import { spawn, exec, type ChildProcess } from "child_process";
import { get } from "http";
import { existsSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { homedir, arch, platform } from "os";

interface NgrokState {
  process: ChildProcess | null;
  publicUrl: string | null;
  port: number | null;
  startedAt: string | null;
}

const state: NgrokState = {
  process: null,
  publicUrl: null,
  port: null,
  startedAt: null,
};

function clearState() {
  state.process = null;
  state.publicUrl = null;
  state.port = null;
  state.startedAt = null;
}

// --- Cleanup on exit ---
function cleanup() {
  if (state.process && !state.process.killed) {
    state.process.kill("SIGTERM");
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

// --- Helpers ---

function execAsync(cmd: string, timeoutMs = 60_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stdout, stderr }));
      else resolve({ stdout, stderr });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON from ngrok API")); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

// --- Local binary path ---
const NGROK_DIR = join(homedir(), ".mcp-expose", "bin");
const NGROK_BIN = join(NGROK_DIR, "ngrok");

function getNgrokArch(): string {
  const a = arch();
  if (a === "arm64") return "arm64";
  if (a === "x64" || a === "x86_64") return "amd64";
  return a;
}

function getNgrokPlatform(): string | null {
  const p = platform();
  if (p === "darwin") return "darwin";
  if (p === "linux") return "linux";
  if (p === "win32") return "windows";
  return null;
}

// --- Core functions ---

export async function ensureNgrokInstalled(): Promise<{ installed: boolean; path: string | null; error?: string }> {
  // 1. Check global ngrok in PATH
  try {
    const { stdout } = await execAsync("which ngrok");
    return { installed: true, path: stdout.trim() };
  } catch {
    // Not in PATH
  }

  // 2. Check locally downloaded binary
  if (existsSync(NGROK_BIN)) {
    return { installed: true, path: NGROK_BIN };
  }

  // 3. Auto-download ngrok binary
  const os = getNgrokPlatform();
  const a = getNgrokArch();

  if (!os) {
    return {
      installed: false,
      path: null,
      error: `Unsupported platform: ${platform()}. Install ngrok manually: https://ngrok.com/download`,
    };
  }

  const ext = os === "windows" ? "zip" : "zip";
  const url = `https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-${os}-${a}.${ext}`;

  console.error(`[mcp-expose] ngrok not found. Downloading from ${url}...`);

  try {
    mkdirSync(NGROK_DIR, { recursive: true });

    const zipPath = join(NGROK_DIR, "ngrok.zip");

    // Download with curl (available on macOS/Linux by default)
    await execAsync(`curl -fsSL -o "${zipPath}" "${url}"`, 120_000);

    // Unzip
    await execAsync(`unzip -o "${zipPath}" -d "${NGROK_DIR}"`, 30_000);

    // Make executable
    if (os !== "windows") {
      chmodSync(NGROK_BIN, 0o755);
    }

    // Cleanup zip
    await execAsync(`rm -f "${zipPath}"`);

    if (existsSync(NGROK_BIN)) {
      console.error(`[mcp-expose] ngrok installed to ${NGROK_BIN}`);
      return { installed: true, path: NGROK_BIN };
    }

    return {
      installed: false,
      path: null,
      error: `Download succeeded but ngrok binary not found at ${NGROK_BIN}. Install manually: https://ngrok.com/download`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      installed: false,
      path: null,
      error: `Failed to download ngrok: ${msg}. Install manually: https://ngrok.com/download`,
    };
  }
}

interface StartOptions {
  port: number;
  authtoken?: string;
  region?: string;
}

export async function startNgrokTunnel(options: StartOptions): Promise<{ url: string } | { error: string }> {
  // Already running — return existing URL
  if (state.process && !state.process.killed && state.publicUrl) {
    if (state.port === options.port) {
      return { url: state.publicUrl };
    }
    // Different port requested — stop existing tunnel first
    await stopNgrokTunnel();
  }

  // Ensure ngrok is installed
  const check = await ensureNgrokInstalled();
  if (!check.installed) {
    return { error: check.error ?? "ngrok not available" };
  }

  const ngrokPath = check.path!;

  // Configure authtoken if provided
  if (options.authtoken) {
    try {
      await execAsync(`"${ngrokPath}" config add-authtoken ${options.authtoken}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `Failed to set ngrok authtoken: ${msg}` };
    }
  }

  // Build args
  const args = ["http", String(options.port)];
  if (options.region) {
    args.push("--region", options.region);
  }

  // Spawn ngrok
  const child = spawn(ngrokPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  state.process = child;
  state.port = options.port;
  state.startedAt = new Date().toISOString();

  // Auto-clear state on unexpected exit
  child.on("close", () => {
    if (state.process === child) {
      clearState();
    }
  });

  // Collect stderr for error reporting
  let stderrBuf = "";
  child.stderr?.on("data", (chunk) => { stderrBuf += chunk; });

  // Poll ngrok API for public URL
  const maxRetries = 15;
  for (let i = 0; i < maxRetries; i++) {
    await sleep(1000);

    // Check if process died
    if (child.killed || child.exitCode !== null) {
      clearState();
      return { error: `ngrok exited unexpectedly: ${stderrBuf.trim() || "(no output)"}` };
    }

    try {
      const data = await fetchJson("http://127.0.0.1:4040/api/tunnels") as {
        tunnels?: Array<{ public_url: string; proto: string }>;
      };
      const tunnels = data?.tunnels;
      if (tunnels && tunnels.length > 0) {
        // Prefer https tunnel
        const httpsTunnel = tunnels.find((t) => t.proto === "https");
        const url = httpsTunnel?.public_url ?? tunnels[0].public_url;
        state.publicUrl = url;
        return { url };
      }
    } catch {
      // API not ready yet, retry
    }
  }

  // Timeout — kill process
  child.kill("SIGTERM");
  clearState();
  return { error: `Timed out waiting for ngrok tunnel (${maxRetries}s). stderr: ${stderrBuf.trim() || "(none)"}` };
}

export async function stopNgrokTunnel(): Promise<{ stopped: boolean; message: string }> {
  if (!state.process) {
    return { stopped: false, message: "No tunnel is currently running." };
  }

  const pid = state.process.pid;
  state.process.kill("SIGTERM");

  // Wait briefly for exit
  await sleep(500);

  clearState();
  return { stopped: true, message: `Tunnel closed (pid: ${pid}).` };
}

export function getNgrokStatus(): NgrokState {
  return {
    process: null, // Don't expose ChildProcess externally
    publicUrl: state.publicUrl,
    port: state.port,
    startedAt: state.startedAt,
  };
}
