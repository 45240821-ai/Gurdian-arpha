'use strict';
// ログ出力。トークン・APIキーが混ざっていたら伏せ字にする。
// メッセージ本文や個人情報はここに渡さないこと（呼び出し側の決まり）。

const { secretValues } = require('./env');

function redact(value) {
  let s;
  if (value instanceof Error) {
    s = `${value.name}: ${value.message}` + (value.stack ? `\n${value.stack.split('\n').slice(1, 6).join('\n')}` : '');
  } else if (typeof value === 'string') {
    s = value;
  } else {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  }
  for (const secret of secretValues()) s = s.split(secret).join('[秘密]');
  // Discord のボットトークンの形をしたものも伏せる
  s = s.replace(/[\w-]{23,28}\.[\w-]{6}\.[\w-]{27,40}/g, '[トークン]');
  // Webhook URL のトークン部分
  s = s.replace(/(discord(?:app)?\.com\/api\/webhooks\/\d+\/)[\w-]+/g, '$1[秘密]');
  return s;
}

function stamp() {
  return new Date().toISOString();
}

const log = {
  info: (...a) => console.log(stamp(), ...a.map(redact)),
  warn: (...a) => console.warn(stamp(), '⚠️', ...a.map(redact)),
  error: (...a) => console.error(stamp(), '❌', ...a.map(redact)),
};

module.exports = { log, redact };
