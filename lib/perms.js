'use strict';
// 権限の確認。必ずサーバー側（ボットの中）で毎回確かめる。

const { PermissionFlagsBits } = require('discord.js');
const { env } = require('./env');

/** 持ち主（OWNER_ID）かどうか */
function isOwner(userId) {
  return userId === env.ownerId;
}

/**
 * スラッシュコマンドの実行者が、そのサーバーの「サーバー管理」権限を持つか。
 * default_member_permissions はサーバー管理者が上書きできるので、ここでも必ず確認する。
 * interaction.memberPermissions は Discord が実行時点の権限を計算して送ってくる値。
 */
function canManageGuild(interaction) {
  if (!interaction.inGuild()) return false;
  if (isOwner(interaction.user.id)) return true;
  const p = interaction.memberPermissions;
  return Boolean(p && (p.has(PermissionFlagsBits.ManageGuild) || p.has(PermissionFlagsBits.Administrator)));
}

// ロールに付いていたら「危険」とみなす権限（自動付与の対象にしない）
const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageGuildExpressions,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.ViewAuditLog,
];

/**
 * そのロールをボットが自動で付けてよいか。
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkAssignableRole(guild, role) {
  if (!role) return { ok: false, reason: 'ロールが見つかりません / Role not found' };
  if (role.id === guild.id) return { ok: false, reason: '@everyone は使えません / @everyone is not allowed' };
  if (role.managed) return { ok: false, reason: '連携が管理するロールは使えません / Managed roles are not allowed' };
  const me = guild.members.me;
  if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
    return { ok: false, reason: 'ボットより上（または同じ）のロールは使えません / Role is above the bot' };
  }
  if (DANGEROUS_PERMISSIONS.some((perm) => role.permissions.has(perm))) {
    return { ok: false, reason: '管理系の権限を持つロールは使えません / Roles with moderation/admin permissions are not allowed' };
  }
  return { ok: true };
}

module.exports = { isOwner, canManageGuild, checkAssignableRole, DANGEROUS_PERMISSIONS };
