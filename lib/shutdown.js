'use strict';
// 終了時に実行する処理（XP のまとめ書きなど）を登録しておく場所。

const { log } = require('./log');

const hooks = [];

function onShutdown(name, fn) {
  hooks.push({ name, fn });
}

let running = false;
async function runShutdown() {
  if (running) return;
  running = true;
  for (const h of hooks) {
    try {
      await Promise.race([h.fn(), new Promise((r) => setTimeout(r, 5000))]);
    } catch (e) {
      log.error(`終了処理「${h.name}」に失敗しました`, e);
    }
  }
}

module.exports = { onShutdown, runShutdown };
