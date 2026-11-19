'use strict';
// 発言を受け取ったときの処理。
// 今は土台だけ。レベル機能（段階2）と翻訳（段階3）を作ったら、ここから呼び出す。

const { Events } = require('discord.js');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // サーバー外（DM）・ボット・Webhook・システムメッセージは扱わない
    if (!message.inGuild()) return;
    if (message.author.bot || message.webhookId || message.system) return;
    // 段階2: leveling.onMessage(message)
    // 段階3: translation.onMessage(message)
  },
};
