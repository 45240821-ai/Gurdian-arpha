'use strict';
// commands/ と events/ のファイルを自動で読み込む（index.js と deploy-commands.js で共用）。

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function jsFiles(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(full, f));
}

/**
 * コマンドを読み込む。
 * 各ファイルは { data, execute } を export する。
 * 任意: cooldown（秒）, handleComponent(interaction), handleModal(interaction), autocomplete(interaction)
 * customIdPrefix: ボタン等の customId の先頭（例: 'lb'）。押されたときに handleComponent へ回す。
 */
function loadCommands() {
  const commands = new Map();
  for (const file of jsFiles('commands')) {
    const mod = require(file);
    if (!mod?.data || typeof mod.execute !== 'function') {
      throw new Error(`${path.basename(file)} に data と execute がありません`);
    }
    const name = mod.data.name;
    if (commands.has(name)) throw new Error(`コマンド名が重複しています: ${name}`);
    commands.set(name, mod);
  }
  return commands;
}

/** イベントを読み込む。各ファイルは { name, once?, execute(...args) } を export する */
function loadEvents() {
  return jsFiles('events').map((file) => {
    const mod = require(file);
    if (!mod?.name || typeof mod.execute !== 'function') {
      throw new Error(`${path.basename(file)} に name と execute がありません`);
    }
    return mod;
  });
}

module.exports = { loadCommands, loadEvents };
