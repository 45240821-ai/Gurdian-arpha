'use strict';
// オフラインでできる確認: 全 .js の構文チェックと、コマンド定義が Discord に送れる形かどうか。
//   npm run check

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

let ok = true;
for (const f of walk(ROOT)) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    ok = false;
    console.error(`❌ 構文エラー: ${path.relative(ROOT, f)}\n${e.stderr}`);
  }
}

const { loadCommands, loadEvents } = require('../lib/loader');
try {
  const cmds = loadCommands();
  for (const [name, c] of cmds) {
    const json = c.data.toJSON();
    if (!json.name) throw new Error(`${name}: 名前がありません`);
  }
  console.log(`✅ コマンド ${cmds.size} 個: ${[...cmds.keys()].join(', ')}`);
  console.log(`✅ イベント ${loadEvents().length} 個`);
} catch (e) {
  ok = false;
  console.error('❌ コマンド・イベントの読み込みに失敗:', e.message);
}

if (!ok) process.exit(1);
console.log('✅ 確認が終わりました');
