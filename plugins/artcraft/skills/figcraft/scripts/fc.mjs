#!/usr/bin/env node
// Drive a running FigCraft app through `figcraft-cli mcp --attach <port>`. Node 18+, no dependencies.
//
//   node fc.mjs <tool> '<json args>'
//       one MCP tool call (get_node, screenshot, run_command, list_commands, inspect_ui...)
//   node fc.mjs --steps <file.json> [--doc <path | name of an unsaved file>]
//       the steps, [{command, params}] or {label, commands}, sent as ONE `batch`: one undo step,
//       rolled back whole when a step fails. {"$ref": n} anywhere in params is the id step n
//       returned (sent as the batch's own {"$step": n}, shifted past the pin; a {"$step"} you write
//       is passed through unchanged, for nested batches). With --doc, `doc.list` is read just
//       before and the batch starts with `doc.switch` to the one open file whose path (or, unsaved,
//       name) matches; anything other than exactly one match is refused. Commands act on the tab
//       in front, and tabs move.
//
// Env: FIGCRAFT_PORT (the app's --control port, default 7979), FIGCRAFT_CLI (default
// `figcraft-cli` on PATH), FIGCRAFT_SHOTS (folder for screenshots, default the current directory).
// Image results are written as PNG files and their path printed after `IMAGE`.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const CLI = process.env.FIGCRAFT_CLI ?? 'figcraft-cli';
const PORT = process.env.FIGCRAFT_PORT ?? '7979';
const SHOTS = process.env.FIGCRAFT_SHOTS ?? process.cwd();
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.error("usage: fc.mjs <tool> '<json>' | fc.mjs --steps <file.json> [--doc <path|name>]");
  process.exit(args.length ? 0 : 2);
}
const stepsMode = args[0] === '--steps';
const docWanted = stepsMode && args[2] === '--doc' ? args[3] : null;

const p = spawn(CLI, ['mcp', '--attach', PORT], { stdio: ['pipe', 'pipe', 'inherit'] });
p.on('error', (e) => { console.error(`cannot start ${CLI}: ${e.message} (set FIGCRAFT_CLI)`); process.exit(1); });
const lines = createInterface({ input: p.stdout })[Symbol.asyncIterator]();
let nextId = 0;
const rpc = async (method, params) => {
  const id = nextId++;
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  for (;;) {
    const { value, done } = await lines.next();
    if (done) throw new Error('figcraft-cli closed its output');
    const m = JSON.parse(value);
    if (m.id === id) return m;
  }
};
// One tool call: images saved, the text part parsed; exits 1 on failure.
const call = async (name, toolArgs) => {
  const m = await rpc('tools/call', { name, arguments: toolArgs });
  let out = null;
  for (const c of m.result?.content ?? []) {
    if (c.type === 'image') {
      const f = join(SHOTS, `figcraft-${Date.now()}.png`);
      writeFileSync(f, Buffer.from(c.data, 'base64'));
      console.log('IMAGE', f);
    } else {
      try { out = JSON.parse(c.text); } catch { out = c.text; }
    }
  }
  if (m.error || m.result?.isError) {
    console.log(`${name} FAILED: ${JSON.stringify(m.error ?? out)}`);
    process.exit(1);
  }
  return out;
};
const toStep = (shift) => (v) => Array.isArray(v) ? v.map(toStep(shift))
  : v && typeof v === 'object'
    ? ('$ref' in v ? { $step: v.$ref + shift } : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toStep(shift)(x)])))
    : v;
const show = (out) => out !== null && console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));

try {
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fc', version: '1' } });
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  if (!stepsMode) {
    show(await call(args[0], JSON.parse(args[1] ?? '{}')));
  } else {
    const spec = JSON.parse(readFileSync(args[1], 'utf8'));
    const pin = [];
    if (docWanted) {
      const docs = await call('run_command', { command: 'doc.list', params: {} });
      const hit = docs.filter((d) => d.path === docWanted || (!d.path && d.name === docWanted));
      if (hit.length !== 1) {
        console.log(`--doc ${docWanted}: ${hit.length} open files match`, JSON.stringify(docs.map(({ index, name, path }) => ({ index, name, path }))));
        process.exit(1);
      }
      pin.push({ command: 'doc.switch', params: { index: hit[0].index } });
    }
    const steps = (Array.isArray(spec) ? spec : spec.commands)
      .map((s) => ({ command: s.command, params: toStep(pin.length)(s.params ?? {}) }));
    show(await call('batch', { label: spec.label, commands: [...pin, ...steps] }));
  }
} finally {
  p.stdin.end();
  p.kill();
}
