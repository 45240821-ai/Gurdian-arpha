'use strict';
// サーバーから外れたとき: そのサーバーのデータを30日後に自動で消すようにする。
// （誤ってキックされても、30日以内に戻せば XP や設定は残る）

const { Events } = require('discord.js');
const { expireGuild } = require('../lib/redis');
const { forget } = require('../lib/config');
const { log } = require('../lib/log');

module.exports = {
  name: Events.GuildDelete,
  async execute(guild) {
    // Discord 側の障害で一時的に見えなくなっただけのときは何もしない
    if (guild.available === false) return;
    log.info(`➖ サーバーから退出: ${guild.id}（データは30日後に削除）`);
    forget(guild.id);
    await expireGuild(guild.id);
  },
};
