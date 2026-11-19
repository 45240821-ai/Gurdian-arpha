'use strict';
// /help: コマンドの一覧を日本語と英語で表示する（本人にだけ表示）。

const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const { EPHEMERAL, NO_MENTIONS } = require('../lib/safe');
const { canManageGuild } = require('../lib/perms');

// 表示する説明。まだ作っていないコマンドは、読み込まれていなければ表示されない。
const HELP = [
  { name: 'help', admin: false, ja: 'このヘルプを表示', en: 'Show this help' },
  { name: 'rank', admin: false, ja: 'レベル・XP・順位を表示', en: 'Show your level, XP and rank' },
  { name: 'leaderboard', admin: false, ja: 'XP ランキング（10人ずつ）', en: 'XP leaderboard (10 per page)' },
  { name: 'translate', admin: false, ja: '文章をその場で翻訳（自分にだけ表示）', en: 'Translate text (only you can see it)' },
  { name: '翻訳', admin: false, ja: 'メッセージを右クリック →「アプリ」→「翻訳」', en: 'Right-click a message → Apps → 翻訳 (Translate)' },
  { name: 'ask', admin: false, ja: 'リルシィに質問する', en: 'Ask RL-C1 a question' },
  { name: 'level-config', admin: true, ja: 'レベル機能の設定', en: 'Leveling settings' },
  { name: 'translate-pair', admin: true, ja: '翻訳するチャンネルの組み合わせ', en: 'Channel translation pairs' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('コマンド一覧 / Command list')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const loaded = interaction.client.commands;
    const isManager = canManageGuild(interaction);
    const line = (h) => `**${h.name === '翻訳' ? '翻訳（右クリック）' : '/' + h.name}** — ${h.ja}\n　${h.en}`;

    const general = HELP.filter((h) => !h.admin && loaded.has(h.name)).map(line);
    const admin = HELP.filter((h) => h.admin && loaded.has(h.name)).map(line);

    const embed = new EmbedBuilder()
      .setTitle('RL-C1（リルシィ）コマンド一覧 / Commands')
      .setColor(0x9b8cff)
      .setDescription(general.join('\n') || '（準備中 / Coming soon）');
    if (isManager && admin.length) {
      embed.addFields({ name: '管理者用 / For managers（サーバー管理権限 / Manage Server）', value: admin.join('\n').slice(0, 1024) });
    }
    embed.setFooter({ text: 'ご用があれば、なんなりとどうぞ。 / At your service.' });

    await interaction.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: NO_MENTIONS });
  },
};
