#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const wasmSource = join(rootDir, "node_modules", "ghostty-web", "dist", "ghostty-vt.wasm");
const publicDir = join(rootDir, "public");
const wasmDest = join(publicDir, "ghostty-vt.wasm");

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

// Copy WASM file if source exists
if (existsSync(wasmSource)) {
  copyFileSync(wasmSource, wasmDest);
  console.log("✓ Copied ghostty-vt.wasm to public/");
} else {
  console.warn("⚠ ghostty-vt.wasm not found in node_modules - run pnpm install first");
}
