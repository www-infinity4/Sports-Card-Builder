const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DIAMOND_KINGS_ANCHORS,
  STARTER_WAVE,
  paletteForSubject,
  buildCardSkeleton,
  buildGeminiPrompt,
  getReleasePlan
} = require('../src/style-template');

test('diamond kings anchors include bat-barrel relic integration', () => {
  assert.ok(DIAMOND_KINGS_ANCHORS.includes('Bat-barrel relic integrated into the barrel'));
});

test('subject palettes are fixed and case-insensitive', () => {
  assert.deepEqual(paletteForSubject('aLbIeS', 'diamond-kings-2026'), ['blue', 'purple', 'yellow', 'white', 'green']);
  assert.deepEqual(paletteForSubject('Unknown', 'topps-now-2026'), ['white', 'silver', 'blue', 'gold']);
});

test('prompt includes full transcript and chosen series', () => {
  const prompt = buildGeminiPrompt(
    [
      { role: 'user', content: 'Make this emotional.' },
      { role: 'assistant', content: 'Got it.' },
      { role: 'user', content: 'Keep Diamond Kings framing.' }
    ],
    'Jazz Chisholm Jr.',
    'diamond-kings-2026'
  );

  assert.match(prompt, /Build a card in the "Diamond Kings 2026" release\./);
  assert.match(prompt, /Full chat transcript \(read everything before responding\):/);
  assert.match(prompt, /3\. USER: Keep Diamond Kings framing\./);
  assert.match(prompt, /Consistent Diamond Kings framing/);
});

test('skeleton carries conversation context', () => {
  const card = buildCardSkeleton('Manzardo', [{ role: 'user', content: 'Use red and navy.' }], 'diamond-kings-2026');
  assert.equal(card.subject, 'Manzardo');
  assert.equal(card.conversationContext[0], 'user: Use red and navy.');
});

test('release plan includes first three starter cards', () => {
  const plan = getReleasePlan();
  assert.equal(plan.starterWave.length, 3);
  assert.deepEqual(plan.starterWave, STARTER_WAVE);
  assert.equal(plan.starterWave[0], 'Dave Stieb - Most Underrated Pitcher of the 1980s');
  assert.ok(plan.series['team-spotlight-2026']);
});
