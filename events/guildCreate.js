'use strict';
// サーバーに参加したとき: 以前の退出で付けた「30日後に削除」を取り消す。

const { Events } = require('discord.js');
const { keepGuild } = require('../lib/redis');
const { log } = require('../lib/log');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    log.info(`➕ サーバーに参加: ${guild.id}（${guild.memberCount} 人）`);
    await keepGuild(guild.id);
  },
};
