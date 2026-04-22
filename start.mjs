#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try compiled dist first, fallback to tsx for dev
try {
  await import(join(__dirname, "dist", "index.js"));
} catch {
  // Fallback: run from source via tsx
  const { register } = await import("node:module");
  try {
    register("tsx/esm", import.meta.url);
  } catch {
    // tsx not available, try source directly
  }
  await import(join(__dirname, "src", "index.ts"));
}
