'use strict';
// Upstash Redis（REST）の接続と、キー名の定義。
// キー名には「検証済みの数字ID」と「日付」しか入れない（ユーザー入力をそのまま入れない）。
// サーバーごとのデータは必ずサーバーIDを含むキーに入れ、他のサーバーと混ざらないようにする。

const { Redis } = require('@upstash/redis');
const { isSnowflake } = require('./safe');

let client = null;

/** Redis クライアント（初回に作る） */
function redis() {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
      // JSON の自動変換は使わず、読み書きは自分で JSON.parse / stringify する（想定外の型を防ぐ）
      automaticDeserialization: false,
    });
  }
  return client;
}

/** ID を検証してから返す。不正なら例外（キーの衝突・注入を防ぐ） */
function id(v, label = 'ID') {
  if (!isSnowflake(v)) throw new TypeError(`不正な${label}です`);
  return v;
}

/** 日本時間の日付 YYYY-MM-DD */
function todayJst(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// キー名の一覧（ここ以外でキー名を組み立てない）
const keys = {
  cfg: (guildId) => `cfg:${id(guildId, 'サーバーID')}`,          // サーバー設定（JSON）
  xp: (guildId) => `xp:${id(guildId, 'サーバーID')}`,            // ソート済みセット（メンバー→累計XP）
  tr: (guildId) => `tr:${id(guildId, 'サーバーID')}`,            // 翻訳ペア一覧（JSON）
  trmap: (messageId) => `trmap:${id(messageId, 'メッセージID')}`, // 翻訳先メッセージ（7日で消える）
  usage: (date = todayJst()) => `usage:${/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayJst()}`, // その日の使用量
  audit: (guildId) => `audit:${id(guildId, 'サーバーID')}`,      // 変更履歴（リスト）
};

// サーバーを退出したときに期限を付けるキー（30日以内に戻れば元通り）
function guildKeys(guildId) {
  return [keys.cfg(guildId), keys.xp(guildId), keys.tr(guildId), keys.audit(guildId)];
}

const TTL = {
  trmap: 7 * 24 * 3600,
  usage: 3 * 24 * 3600,
  leftGuild: 30 * 24 * 3600,
};

/** JSON を読む（壊れていたら null） */
async function getJson(key) {
  const raw = await redis().get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setJson(key, value, ttlSec) {
  const s = JSON.stringify(value);
  if (ttlSec) await redis().set(key, s, { ex: ttlSec });
  else await redis().set(key, s);
}

/** 起動時の接続確認 */
async function ping() {
  const r = await redis().ping();
  return r === 'PONG';
}

/** ボットがサーバーから外れたとき: 30日後に自動で消えるようにする */
async function expireGuild(guildId) {
  const p = redis().pipeline();
  for (const k of guildKeys(guildId)) p.expire(k, TTL.leftGuild);
  await p.exec();
}

/** サーバーに戻ってきたとき: 消える予定を取り消す */
async function keepGuild(guildId) {
  const p = redis().pipeline();
  for (const k of guildKeys(guildId)) p.persist(k);
  await p.exec();
}

/** そのサーバーのデータをすぐに全部消す（持ち主・管理者の操作用） */
async function deleteGuild(guildId) {
  await redis().del(...guildKeys(guildId));
}

module.exports = { redis, keys, TTL, todayJst, getJson, setJson, ping, expireGuild, keepGuild, deleteGuild };
