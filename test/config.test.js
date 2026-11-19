'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { configSchema, DEFAULTS } = require('../lib/config');

test('既定値はスキーマに合う', () => {
  assert.ok(configSchema.safeParse(DEFAULTS).success);
});

test('知らない項目は拒否する', () => {
  const bad = JSON.parse(JSON.stringify(DEFAULTS));
  bad.leveling.isAdmin = true;
  assert.ok(!configSchema.safeParse(bad).success);
});

test('範囲外・型違いは拒否する', () => {
  const bad = JSON.parse(JSON.stringify(DEFAULTS));
  bad.leveling.xpPerMessageMax = 100000;
  assert.ok(!configSchema.safeParse(bad).success);
  const bad2 = JSON.parse(JSON.stringify(DEFAULTS));
  bad2.leveling.notifyChannelId = 'abc';
  assert.ok(!configSchema.safeParse(bad2).success);
});
