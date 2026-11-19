'use strict';
// 環境変数の読み込みと検査。
// 必須の値がなければ、分かりやすいメッセージを出して起動を止める。
// 値そのもの（トークンなど）は絶対にログへ出さない。

const SNOWFLAKE = /^\d{17,20}$/;

// ボット本体が動くのに必要なもの
const CORE = ['BOT_TOKEN', 'CLIENT_ID', 'OWNER_ID', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];

// 機能ごとに必要なもの（その機能を作った段階で必須になる）
const FEATURE = {
  ai: ['ANTHROPIC_API_KEY'],
  translation: ['DEEPL_TOKEN'],
  dashboard: ['CLIENT_SECRET', 'OAUTH_REDIRECT_URI', 'SESSION_SECRET'],
};

function fail(lines) {
  console.error('❌ 起動できません / Cannot start:');
  for (const l of lines) console.error('   - ' + l);
  console.error('   Replit の Secrets（VPS なら .env）を確認してください。');
  process.exit(1);
}

/**
 * 必須の環境変数をまとめて確認する。
 * @param {string[]} features 追加で必須にする機能名（'ai' | 'translation' | 'dashboard'）
 */
function checkEnv(features = []) {
  const missing = [];
  const names = [...CORE, ...features.flatMap((f) => FEATURE[f] || [])];
  for (const n of names) {
    if (!process.env[n] || !process.env[n].trim()) missing.push(`${n} が未設定です`);
  }
  if (missing.length) fail(missing);

  const errors = [];
  if (!SNOWFLAKE.test(process.env.CLIENT_ID.trim())) errors.push('CLIENT_ID は数字のIDにしてください');
  if (!SNOWFLAKE.test(process.env.OWNER_ID.trim())) errors.push('OWNER_ID は数字のIDにしてください');
  if (!/^https:\/\//.test(process.env.UPSTASH_REDIS_REST_URL.trim())) {
    errors.push('UPSTASH_REDIS_REST_URL は https:// で始まる必要があります');
  }
  if (features.includes('dashboard')) {
    if (process.env.SESSION_SECRET.length < 32) errors.push('SESSION_SECRET は32文字以上のランダムな文字列にしてください');
    if (!/^https?:\/\//.test(process.env.OAUTH_REDIRECT_URI)) errors.push('OAUTH_REDIRECT_URI は URL にしてください');
  }
  if (errors.length) fail(errors);
}

const env = {
  get token() { return process.env.BOT_TOKEN.trim(); },
  get clientId() { return process.env.CLIENT_ID.trim(); },
  get ownerId() { return process.env.OWNER_ID.trim(); },
  get port() {
    const p = Number(process.env.PORT || 3000);
    return Number.isInteger(p) && p > 0 && p < 65536 ? p : 3000;
  },
  get devGuildId() {
    const g = (process.env.DEV_GUILD_ID || '').trim();
    return SNOWFLAKE.test(g) ? g : null;
  },
};

// ログやエラーに混ざったときに伏せ字にするための「秘密の値」一覧
const SECRET_NAMES = [
  'BOT_TOKEN', 'CLIENT_SECRET', 'SESSION_SECRET', 'UPSTASH_REDIS_REST_TOKEN',
  'ANTHROPIC_API_KEY', 'DEEPL_TOKEN',
];
function secretValues() {
  return SECRET_NAMES.map((n) => process.env[n]).filter((v) => typeof v === 'string' && v.length >= 8);
}

module.exports = { checkEnv, env, secretValues, SNOWFLAKE };
