import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const BASE_DIR = join(homedir(), ".mcp-expose");
const LOGS_DIR = join(BASE_DIR, "logs");

export interface HistoryEntry {
  id: string;
  toolName: string;
  status: "running" | "success" | "failed";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  params: Record<string, unknown>;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadHistory(): HistoryEntry[] {
  const path = join(BASE_DIR, "history.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  ensureDir(BASE_DIR);
  writeFileSync(join(BASE_DIR, "history.json"), JSON.stringify(entries, null, 2));
}

export function addHistoryEntry(entry: HistoryEntry) {
  const history = loadHistory();
  history.unshift(entry);
  // Keep last 500 entries
  if (history.length > 500) history.length = 500;
  saveHistory(history);
}

export function updateHistoryEntry(runId: string, updates: Partial<HistoryEntry>) {
  const history = loadHistory();
  const entry = history.find((e) => e.id === runId);
  if (entry) Object.assign(entry, updates);
  saveHistory(history);
}

export function getHistory(limit = 20): HistoryEntry[] {
  return loadHistory().slice(0, limit);
}

export function getEntry(runId: string): HistoryEntry | undefined {
  return loadHistory().find((e) => e.id === runId);
}

export function writeLog(runId: string, content: string) {
  ensureDir(LOGS_DIR);
  writeFileSync(join(LOGS_DIR, `${runId}.log`), content);
}

export function readLog(runId: string): string {
  const path = join(LOGS_DIR, `${runId}.log`);
  if (!existsSync(path)) return "(no log available)";
  return readFileSync(path, "utf-8");
}
