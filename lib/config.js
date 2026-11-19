'use strict';
// サーバーごとの設定の読み書きと、変更履歴（監査ログ）。
// 設定は zod のスキーマで厳密に検証する（知らない項目・範囲外の値は保存しない）。

const { z } = require('zod');
const { redis, keys, getJson, setJson } = require('./redis');
const { log } = require('./log');

const snowflake = z.string().regex(/^\d{17,20}$/);

// ── 設定のスキーマ（新しい機能を作るたびに、ここへ項目を足す） ──
const levelingSchema = z.object({
  enabled: z.boolean(),
  xpPerMessageMax: z.number().int().min(1).max(500),   // 1発言の XP 上限【要調整】
  cooldownSec: z.number().int().min(10).max(3600),     // 同じ人の加算間隔（秒）
  curveA: z.number().int().min(1).max(10000),          // 必要XP = A×L² + B×L の A【要調整】
  curveB: z.number().int().min(0).max(10000),          // 同じく B【要調整】
  notifyChannelId: snowflake.nullable(),               // レベルアップ通知先（null ならその場）
  excludedChannels: z.array(snowflake).max(200),       // XP を数えないチャンネル
  roleRewards: z.array(z.object({ level: z.number().int().min(1).max(1000), roleId: snowflake }).strict()).max(50),
  removeLowerRoles: z.boolean(),                       // 上位ロールを付けたら下位を外す
}).strict();

const configSchema = z.object({
  version: z.literal(1),
  leveling: levelingSchema,
}).strict();

const DEFAULTS = Object.freeze({
  version: 1,
  leveling: {
    enabled: true,
    xpPerMessageMax: 50,
    cooldownSec: 60,
    curveA: 50,
    curveB: 50,
    notifyChannelId: null,
    excludedChannels: [],
    roleRewards: [],
    removeLowerRoles: false,
  },
});

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

/** 保存済みの値と既定値を合わせる（項目が増えたときの互換用） */
function withDefaults(stored) {
  const base = clone(DEFAULTS);
  if (!stored || typeof stored !== 'object') return base;
  for (const section of Object.keys(base)) {
    if (section === 'version') continue;
    if (stored[section] && typeof stored[section] === 'object') {
      for (const k of Object.keys(base[section])) {
        if (k in stored[section]) base[section][k] = stored[section][k];
      }
    }
  }
  const parsed = configSchema.safeParse(base);
  return parsed.success ? parsed.data : clone(DEFAULTS);
}

// メッセージのたびに Redis を読まないよう、少しの間メモリに置く
const CACHE_MS = 30 * 1000;
const cache = new Map(); // guildId -> { at, value }

async function getConfig(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < CACHE_MS) return clone(hit.value);
  const value = withDefaults(await getJson(keys.cfg(guildId)));
  cache.set(guildId, { at: Date.now(), value });
  return clone(value);
}

// 同じサーバーの設定変更が同時に来ても、順番に処理する
const locks = new Map();
function withLock(guildId, fn) {
  const prev = locks.get(guildId) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(guildId, next.finally(() => { if (locks.get(guildId) === next) locks.delete(guildId); }));
  return next;
}

/**
 * 設定を変更して保存し、変更履歴に残す。
 * @param {string} guildId
 * @param {(cfg) => void} mutate 設定を書き換える関数
 * @param {{ userId: string, source: 'command'|'dashboard', action: string }} actor
 * @returns {Promise<object>} 保存後の設定
 */
async function updateConfig(guildId, mutate, actor) {
  return withLock(guildId, async () => {
    cache.delete(guildId);
    const before = withDefaults(await getJson(keys.cfg(guildId)));
    const draft = clone(before);
    mutate(draft);
    const parsed = configSchema.safeParse(draft);
    if (!parsed.success) {
      const err = new Error('設定の値が正しくありません / Invalid settings');
      err.userMessage = err.message;
      throw err;
    }
    await setJson(keys.cfg(guildId), parsed.data);
    cache.set(guildId, { at: Date.now(), value: parsed.data });
    await audit(guildId, { ...actor, changes: diff(before, parsed.data) });
    return clone(parsed.data);
  });
}

/** 変更前後の差分（項目名と値だけ。メッセージ本文などは入れない） */
function diff(a, b, prefix = '') {
  const out = [];
  const ks = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of ks) {
    const path = prefix ? `${prefix}.${k}` : k;
    const va = a?.[k];
    const vb = b?.[k];
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va)) {
      out.push(...diff(va, vb, path));
    } else if (JSON.stringify(va) !== JSON.stringify(vb)) {
      out.push({ path, from: va ?? null, to: vb ?? null });
    }
  }
  return out.slice(0, 50);
}

const AUDIT_MAX = 500;

/**
 * 変更履歴に1件追加する（新しい方から最大500件）。
 * entry: { userId, source, action, changes?, note? }
 */
async function audit(guildId, entry) {
  try {
    const record = {
      at: new Date().toISOString(),
      userId: String(entry.userId || ''),
      source: entry.source || 'command',
      action: String(entry.action || '').slice(0, 100),
      changes: entry.changes || [],
      note: entry.note ? String(entry.note).slice(0, 200) : undefined,
    };
    const p = redis().pipeline();
    p.lpush(keys.audit(guildId), JSON.stringify(record));
    p.ltrim(keys.audit(guildId), 0, AUDIT_MAX - 1);
    await p.exec();
  } catch (e) {
    log.error('変更履歴の保存に失敗しました', e);
  }
}

/** 変更履歴を読む（新しい順） */
async function readAudit(guildId, start = 0, count = 50) {
  const raw = await redis().lrange(keys.audit(guildId), start, start + count - 1);
  return raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}

/** 退出したサーバーのキャッシュを捨てる */
function forget(guildId) {
  cache.delete(guildId);
}

module.exports = { configSchema, levelingSchema, DEFAULTS, getConfig, updateConfig, audit, readAudit, forget };
