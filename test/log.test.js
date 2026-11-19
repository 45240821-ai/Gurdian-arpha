'use strict';
const test = require('node:test');
const assert = require('node:assert');

test('ログからトークンと Webhook の秘密を伏せる', () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-secret-value-1234567890';
  const { redact } = require('../lib/log');
  const s = redact(`key=${process.env.ANTHROPIC_API_KEY} hook=https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-123`);
  assert.ok(!s.includes('sk-ant-test-secret'));
  assert.ok(!s.includes('abcDEF_ghi-123'));
  // ボットトークンの形
  const fake = 'M' + 'T'.repeat(25) + '.' + 'G'.repeat(6) + '.' + 'x'.repeat(38);
  assert.ok(!redact(fake).includes(fake));
});
