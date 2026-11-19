'use strict';
const { Events, ActivityType } = require('discord.js');
const { log } = require('../lib/log');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log.info(`✅ ボット起動: ${client.user.tag}（${client.guilds.cache.size} サーバー）`);
    client.user.setPresence({
      status: 'online',
      activities: [{ type: ActivityType.Custom, name: 'custom', state: '/help でコマンド一覧 / commands' }],
    });
  },
};
