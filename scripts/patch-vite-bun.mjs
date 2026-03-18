import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'node_modules', 'vite', 'dist', 'node', 'chunks', 'node.js');

const needle = 'socket.destroySoon();';
const replacement = 'if (typeof socket.destroySoon === "function") socket.destroySoon(); else { socket.end(); socket.destroy(); }';

if (!existsSync(file)) {
  console.log('[patch-vite-bun] Skipped: Vite runtime chunk not found.');
  process.exit(0);
}

const source = readFileSync(file, 'utf8');
if (source.includes(replacement)) {
  console.log('[patch-vite-bun] Already patched.');
  process.exit(0);
}

if (!source.includes(needle)) {
  console.log('[patch-vite-bun] Skipped: expected pattern not found.');
  process.exit(0);
}

const next = source.split(needle).join(replacement);
writeFileSync(file, next, 'utf8');
console.log('[patch-vite-bun] Patched Vite proxy socket fallback for Bun.');
