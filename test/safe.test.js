'use strict';
// 安全対策の部品のテスト（ネットにつながずに動く）。 npm test
const test = require('node:test');
const assert = require('node:assert');
const { neutralize, splitMessage, isSnowflake, clampInt, truncate } = require('../lib/safe');

test('@everyone と @here を無効化する', () => {
  const s = neutralize('@everyone と @here');
  assert.ok(!/@everyone/.test(s.replace(/​/g, 'X')));
  assert.ok(!s.includes('@here'));
});

test('ユーザー・ロールのメンションを無効化する', () => {
  const s = neutralize('<@123456789012345678> <@&123456789012345678> <@!123456789012345678>');
  assert.ok(!/<@!?&?\d{17,20}>/.test(s));
});

test('招待リンクを消す', () => {
  for (const u of ['discord.gg/abc', 'https://discord.com/invite/abc', 'https://discordapp.com/invite/x-y', 'dsc.gg/zz']) {
    assert.ok(!neutralize(`見て ${u}`).includes(u), u);
  }
});

test('stripLinks で普通のURLも消す', () => {
  assert.ok(!neutralize('https://example.com/a', { stripLinks: true }).includes('example.com'));
});

test('2000文字を超えたら分割し、各部分は2000以下', () => {
  const parts = splitMessage('あ'.repeat(4500));
  assert.strictEqual(parts.join('').length, 4500);
  assert.ok(parts.every((p) => p.length <= 2000));
});

test('IDの検証', () => {
  assert.ok(isSnowflake('123456789012345678'));
  assert.ok(!isSnowflake('12345'));
  assert.ok(!isSnowflake('123456789012345678:x'));
  assert.ok(!isSnowflake(123456789012345678));
});

test('範囲制限と切り詰め', () => {
  assert.strictEqual(clampInt('999', 1, 10, 5), 10);
  assert.strictEqual(clampInt('abc', 1, 10, 5), 5);
  assert.strictEqual(truncate('abcdef', 4), 'abc…');
});
