'use strict';
// スラッシュコマンド・右クリックメニュー・ボタン・モーダルの振り分け。
// 権限の確認は各コマンドの中で毎回行う（ここでは乱用防止のクールダウンだけ）。

const { Events } = require('discord.js');
const { log } = require('../lib/log');
const { respond } = require('../lib/safe');
const { isOwner } = require('../lib/perms');

// ── クールダウン（ユーザーごと） ──
const DEFAULT_COOLDOWN_SEC = 2;   // どのコマンドでも最低この間隔
const COMPONENT_COOLDOWN_MS = 700; // ボタン連打対策
const lastUsed = new Map();        // `${userId}:${name}` -> 時刻

function cooldownLeft(userId, name, sec) {
  const key = `${userId}:${name}`;
  const now = Date.now();
  const prev = lastUsed.get(key) || 0;
  const left = prev + sec * 1000 - now;
  if (left > 0) return left;
  lastUsed.set(key, now);
  return 0;
}
// 古い記録を定期的に捨てる（メモリが増え続けないように）
setInterval(() => {
  const limit = Date.now() - 10 * 60 * 1000;
  for (const [k, t] of lastUsed) if (t < limit) lastUsed.delete(k);
}, 5 * 60 * 1000).unref();

async function safeError(interaction, e) {
  // 利用者向けのメッセージだけ見せ、内部の情報は出さない
  const msg = e?.userMessage || '⚠️ エラーが発生しました。時間をおいて試してください。\nAn error occurred. Please try again later.';
  try {
    await respond(interaction, msg);
  } catch {
    /* 応答期限切れなどで返せないときはログだけ残す */
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // ── スラッシュコマンド / 右クリックメニュー ──
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      const sec = Math.max(DEFAULT_COOLDOWN_SEC, cmd.cooldown || 0);
      const left = isOwner(interaction.user.id) ? 0 : cooldownLeft(interaction.user.id, interaction.commandName, sec);
      if (left > 0) {
        await respond(interaction, `⏳ あと ${Math.ceil(left / 1000)} 秒待ってください / Please wait ${Math.ceil(left / 1000)}s`);
        return;
      }
      try {
        await cmd.execute(interaction);
      } catch (e) {
        log.error(`コマンド /${interaction.commandName} でエラー（サーバー ${interaction.guildId ?? 'DM'}）`, e);
        await safeError(interaction, e);
      }
      return;
    }

    // ── 入力補完 ──
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd?.autocomplete) return;
      try {
        await cmd.autocomplete(interaction);
      } catch (e) {
        log.error(`入力補完 /${interaction.commandName} でエラー`, e);
      }
      return;
    }

    // ── ボタン・セレクト・モーダル ──
    // customId は「コマンドの接頭辞:中身」。中身は信用せず、各コマンドで押した人と権限を確かめる。
    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      const prefix = String(interaction.customId).split(':')[0];
      const cmd = [...client.commands.values()].find((c) => c.customIdPrefix === prefix);
      const fn = interaction.isModalSubmit() ? cmd?.handleModal : cmd?.handleComponent;
      if (!fn) return;
      if (cooldownLeft(interaction.user.id, `component:${prefix}`, COMPONENT_COOLDOWN_MS / 1000) > 0) {
        try { await interaction.deferUpdate(); } catch { /* 無視 */ }
        return;
      }
      try {
        await fn(interaction);
      } catch (e) {
        log.error(`部品 ${prefix} の処理でエラー`, e);
        await safeError(interaction, e);
      }
    }
  },
};
