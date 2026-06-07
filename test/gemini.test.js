const test = require('node:test');
const assert = require('node:assert/strict');

const { parseJsonFromText } = require('../src/gemini');

test('parseJsonFromText extracts first valid JSON object from mixed text', () => {
  const parsed = parseJsonFromText('note: {"reply":"ok","card":{"subject":"X"}} trailing');
  assert.equal(parsed.reply, 'ok');
  assert.equal(parsed.card.subject, 'X');
});
