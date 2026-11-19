'use strict';
// 送信まわりの安全対策をまとめた部品。

const { MessageFlags } = require('discord.js');
const { SNOWFLAKE } = require('./env');

// 送信時は必ずこれを付ける（@everyone・ロール・ユーザーへの通知を一切飛ばさない）
const NO_MENTIONS = Object.freeze({ parse: [], repliedUser: false });

// 本人にだけ見える応答
const EPHEMERAL = MessageFlags.Ephemeral;

const MAX_MESSAGE = 2000;

/** ID（スノーフレーク）かどうか。数字だけ・17〜20桁 */
function isSnowflake(v) {
  return typeof v === 'string' && SNOWFLAKE.test(v);
}

/** 数値を範囲内に収める。数でなければ既定値 */
function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * 外から来た文字列（AIの出力・ユーザー入力）を表示用に無害化する。
 * - @everyone / @here を無効化
 * - ユーザー・ロールのメンションを無効化（ゼロ幅スペースを挟む）
 * - 招待リンクを除去
 */
function neutralize(text, { stripLinks = false } = {}) {
  let s = String(text ?? '');
  s = s.replace(/@(everyone|here)/gi, '@​$1');
  s = s.replace(/<@([!&]?)(\d{17,20})>/g, '<@​$1$2>');
  s = s.replace(/(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.(?:gg|com\/invite|io|me|li)|dsc\.gg)\/[\w-]+/gi, '[招待リンク削除 / invite removed]');
  if (stripLinks) s = s.replace(/https?:\/\/\S+/gi, '[リンク省略 / link removed]');
  return s;
}

/** 長さ制限（超えたら … を付けて切る） */
function truncate(text, max) {
  const s = String(text ?? '');
  return s.length > max ? s.slice(0, Math.max(0, max - 1)) + '…' : s;
}

/** 2000文字を超える文章を、なるべく改行で区切って分割する */
function splitMessage(text, max = MAX_MESSAGE) {
  const s = String(text ?? '');
  if (s.length <= max) return [s];
  const parts = [];
  let rest = s;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest.length) parts.push(rest);
  return parts;
}

/**
 * インタラクションへの応答（長文は分割、メンションは無効）。
 * defer 済み・返信済みかを見て、reply / editReply / followUp を使い分ける。
 */
async function respond(interaction, content, { ephemeral = true } = {}) {
  const parts = splitMessage(content);
  const base = { allowedMentions: NO_MENTIONS };
  for (let i = 0; i < parts.length; i++) {
    const payload = { ...base, content: parts[i] };
    if (i === 0 && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ ...payload, flags: ephemeral ? EPHEMERAL : undefined });
    } else if (i === 0 && interaction.deferred && !interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.followUp({ ...payload, flags: ephemeral ? EPHEMERAL : undefined });
    }
  }
}

/** チャンネルへ送る（長文は分割、メンションは無効） */
async function sendSafe(channel, content, extra = {}) {
  const sent = [];
  for (const part of splitMessage(content)) {
    sent.push(await channel.send({ ...extra, content: part, allowedMentions: NO_MENTIONS }));
  }
  return sent;
}

module.exports = {
  NO_MENTIONS, EPHEMERAL, MAX_MESSAGE,
  isSnowflake, clampInt, neutralize, truncate, splitMessage, respond, sendSafe,
};
