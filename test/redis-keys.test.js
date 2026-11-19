'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { keys, todayJst } = require('../lib/redis');

test('キー名はサーバーIDごとに分かれる', () => {
  assert.strictEqual(keys.cfg('123456789012345678'), 'cfg:123456789012345678');
  assert.strictEqual(keys.xp('123456789012345678'), 'xp:123456789012345678');
});

test('不正なIDではキーを作らない（キーの注入・衝突を防ぐ）', () => {
  assert.throws(() => keys.cfg('123:other'));
  assert.throws(() => keys.cfg('*'));
  assert.throws(() => keys.trmap(''));
  assert.throws(() => keys.audit(undefined));
});

test('日付は日本時間', () => {
  // 2026-01-01 15:30 UTC は 日本時間 2026-01-02 00:30
  assert.strictEqual(todayJst(new Date('2026-01-01T15:30:00Z')), '2026-01-02');
  assert.strictEqual(keys.usage('bad'), `usage:${todayJst()}`);
});
