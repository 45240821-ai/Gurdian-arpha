'use strict';
// RL-C1（リルシィ）起動ファイル。
// 1. 環境変数を確認  2. コマンドとイベントを読み込む  3. Redis を確認  4. ログイン

require('./lib/dotenv-lite').load();

const http = require('node:http');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { checkEnv, env } = require('./lib/env');
const { log } = require('./lib/log');
const { loadCommands, loadEvents } = require('./lib/loader');
const { ping } = require('./lib/redis');
const { runShutdown } = require('./lib/shutdown');

// ── 1. 環境変数（足りなければここで終了） ──
checkEnv([]);

// ── 落ちないための最後の受け皿（握りつぶさずログに出す） ──
process.on('unhandledRejection', (reason) => log.error('未処理の Promise 拒否', reason));
process.on('uncaughtException', (err) => log.error('未処理の例外', err));

// ── 2. クライアント ──
// インテントは必要なものだけ。
//  Guilds          : サーバー・チャンネル・ロールの情報
//  GuildMessages   : 発言を受け取る（XP・翻訳）
//  MessageContent  : 発言の本文（XP の文字数・翻訳に必要。Developer Portal で有効化が必要）
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  // 翻訳の「編集・削除の反映」で、キャッシュにない古い発言のイベントも受け取るため
  partials: [Partials.Message],
  // 念のため、ボットが送るものはすべて既定でメンション無効
  allowedMentions: { parse: [], repliedUser: false },
});

client.commands = new Collection(loadCommands());
for (const ev of loadEvents()) {
  const handler = async (...args) => {
    try {
      await ev.execute(...args, client);
    } catch (e) {
      log.error(`イベント ${ev.name} の処理でエラー`, e);
    }
  };
  if (ev.once) client.once(ev.name, handler);
  else client.on(ev.name, handler);
}
log.info(`📦 コマンド ${client.commands.size} 個を読み込みました: ${[...client.commands.keys()].map((n) => '/' + n).join(' ')}`);

// ── 稼働確認用の小さな HTTP サーバー（UptimeRobot 用。ダッシュボードを作ったら差し替える） ──
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end('ok');
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
  server.requestTimeout = 10_000;
  server.listen(env.port, () => log.info(`🌐 HTTP 待ち受け: ポート ${env.port}`));
  return server;
}

// ── 終了処理 ──
async function shutdown(signal) {
  log.info(`🛑 ${signal} を受け取りました。終了します`);
  await runShutdown();
  try { await client.destroy(); } catch { /* 終了時なので無視してよい */ }
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── 3. 起動 ──
(async () => {
  try {
    if (!(await ping())) throw new Error('PING の応答が想定外です');
    log.info('✅ Upstash Redis に接続しました');
  } catch (e) {
    log.error('Upstash Redis に接続できません。URL とトークンを確認してください', e);
    process.exit(1);
  }
  startHealthServer();
  try {
    await client.login(env.token);
  } catch (e) {
    log.error('Discord にログインできません。BOT_TOKEN を確認してください', e);
    process.exit(1);
  }
})();
