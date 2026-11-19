'use strict';
// VPS などで .env ファイルを使うときのための、最小限の読み込み。
// Replit では Secrets が環境変数に入るので、.env がなければ何もしない。
// すでに設定されている環境変数は上書きしない。

const fs = require('node:fs');
const path = require('node:path');

function load(file = path.join(__dirname, '..', '.env')) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

module.exports = { load };
