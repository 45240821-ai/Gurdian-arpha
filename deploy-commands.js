'use strict';
// スラッシュコマンドを Discord に登録する。
//
//   node deploy-commands.js                 … DEV_GUILD_ID があればそのサーバーだけ、なければ全体に登録
//   node deploy-commands.js --guild 123…    … 指定したテスト用サーバーだけに登録（すぐ反映）
//   node deploy-commands.js --global        … 全サーバーに登録（反映まで最大1時間ほど）
//   node deploy-commands.js --clear-guild 123…  … テスト用サーバーの登録を消す（全体登録との二重表示を防ぐ）

require('./lib/dotenv-lite').load();

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./lib/loader');
const { isSnowflake } = require('./lib/safe');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const token = (process.env.BOT_TOKEN || '').trim();
  const clientId = (process.env.CLIENT_ID || '').trim();
  if (!token || !isSnowflake(clientId)) {
    console.error('❌ BOT_TOKEN と CLIENT_ID（数字）を設定してください');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  const clearGuild = arg('--clear-guild');
  if (clearGuild) {
    if (!isSnowflake(clearGuild)) { console.error('❌ サーバーIDが正しくありません'); process.exit(1); }
    await rest.put(Routes.applicationGuildCommands(clientId, clearGuild), { body: [] });
    console.log(`🧹 サーバー ${clearGuild} のコマンド登録を消しました`);
    return;
  }

  const body = [...loadCommands().values()].map((c) => c.data.toJSON());
  const guildArg = arg('--guild') || (process.argv.includes('--global') ? null : (process.env.DEV_GUILD_ID || '').trim() || null);

  if (guildArg) {
    if (!isSnowflake(guildArg)) { console.error('❌ サーバーIDが正しくありません'); process.exit(1); }
    await rest.put(Routes.applicationGuildCommands(clientId, guildArg), { body });
    console.log(`✅ テスト用サーバー ${guildArg} に ${body.length} 個のコマンドを登録しました: ${body.map((b) => b.name).join(', ')}`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`✅ 全体に ${body.length} 個のコマンドを登録しました（反映まで最大1時間）: ${body.map((b) => b.name).join(', ')}`);
  }
})().catch((e) => {
  // エラー本文にトークンは含まれないが、念のため名前とメッセージだけ出す
  console.error('❌ 登録に失敗しました:', e?.code ?? '', e?.message ?? e);
  process.exit(1);
});
