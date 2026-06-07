const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOCKED_ANCHORS,
  paletteForPlayer,
  buildCardSkeleton,
  buildGeminiPrompt
} = require('../src/style-template');

test('locked anchors include bat-barrel relic integration', () => {
  assert.ok(LOCKED_ANCHORS.includes('Bat-barrel relic integrated into the barrel'));
});

test('player palettes are fixed and case-insensitive', () => {
  assert.deepEqual(paletteForPlayer('Albies'), ['blue', 'purple', 'yellow', 'white', 'green']);
  assert.deepEqual(paletteForPlayer('Unknown'), ['gold', 'black', 'cream']);
});

test('prompt includes full transcript and locked anchors', () => {
  const prompt = buildGeminiPrompt(
    [
      { role: 'user', content: 'Make this emotional.' },
      { role: 'assistant', content: 'Got it.' },
      { role: 'user', content: 'Keep Diamond Kings framing.' }
    ],
    'Jazz'
  );

  assert.match(prompt, /Full chat transcript \(read everything before responding\):/);
  assert.match(prompt, /3\. USER: Keep Diamond Kings framing\./);
  assert.match(prompt, /Consistent Diamond Kings framing/);
});

test('skeleton carries conversation context', () => {
  const card = buildCardSkeleton('Manzardo', [{ role: 'user', content: 'Use red and navy.' }]);
  assert.equal(card.player, 'Manzardo');
  assert.equal(card.conversationContext[0], 'user: Use red and navy.');
});
