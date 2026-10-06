const test = require('node:test');
const assert = require('node:assert/strict');

const AutoCard = require('../public/auto-card.js');

test('no input still yields a complete, numbered card spec', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const spec = AutoCard.buildSpec(AutoCard.parseIntent(''), { seed, year: 2026 });
    assert.ok(spec.player.name, 'player name');
    assert.ok(AutoCard.SETS[spec.set.id], 'known set');
    assert.ok(spec.cardNumber, 'card number');
    assert.ok(spec.title.includes(spec.player.name));
    assert.ok(spec.value.index >= 1 && spec.value.index <= 100);
    if (spec.parallel.printRun) {
      assert.ok(spec.serial >= 1 && spec.serial <= spec.parallel.printRun, 'serial within print run');
    } else {
      assert.equal(spec.serial, 0);
    }
    assert.match(spec.artPrompt, /no text, no letters, no logos/);
  }
});

test('same seed is reproducible, different seeds vary', () => {
  const a = AutoCard.buildSpec({}, { seed: 99, year: 2026 });
  const b = AutoCard.buildSpec({}, { seed: 99, year: 2026 });
  assert.equal(a.title, b.title);
  const titles = new Set();
  for (let seed = 1; seed <= 30; seed += 1) titles.add(AutoCard.buildSpec({}, { seed, year: 2026 }).title);
  assert.ok(titles.size > 20);
});

test('free text steers player, set, parallel and hits', () => {
  const intent = AutoCard.parseIntent('Aaron Judge chrome gold auto relic rookie');
  assert.equal(intent.player, 'Aaron Judge');
  assert.equal(intent.set, 'chrome');
  assert.equal(intent.parallel, 'gold');
  assert.equal(intent.auto, true);
  assert.equal(intent.relic, true);
  assert.equal(intent.rookie, true);
  const spec = AutoCard.buildSpec(intent, { seed: 5, year: 2026 });
  assert.equal(spec.team.abbr, 'NYY');
  assert.equal(spec.parallel.printRun, 50);
  assert.match(spec.cardNumber, /^CARP-AJ$/);
  assert.match(spec.title, /Gold Refractor Auto Relic \d+\/50$/);
});

test('unknown player names are extracted from capitalised text', () => {
  const intent = AutoCard.parseIntent('Make a Mike Trout superfractor');
  assert.equal(intent.player, 'Mike Trout');
  assert.equal(intent.parallel, 'superfractor');
  const spec = AutoCard.buildSpec(intent, { seed: 3, year: 2026 });
  assert.equal(spec.serial, 1);
  assert.equal(spec.value.serialText, '1/1');
});

test('team names do not trigger colour parallels or fake player names', () => {
  const intent = AutoCard.parseIntent('Boston Red Sox and Toronto Blue Jays and Los Angeles Dodgers');
  assert.equal(intent.parallel, '');
  assert.equal(intent.player, '');
  assert.ok(intent.team);
});

test('team-only requests with quoted headlines become team spotlight moments', () => {
  const intent = AutoCard.parseIntent('Orioles "6-Run First Inning" now');
  assert.equal(intent.team, 'BAL');
  assert.equal(intent.set, 'now');
  assert.equal(intent.headline, '6-Run First Inning');
  const spec = AutoCard.buildSpec(intent, { seed: 1, year: 2026 });
  assert.equal(spec.player.teamCard, true);
  assert.equal(spec.player.name, 'Baltimore Orioles');
  assert.equal(spec.auto, false);
});

test('rarity tiers scale with the pull', () => {
  const base = AutoCard.buildSpec(AutoCard.parseIntent('Bryan Woo base flagship no auto no relic'), { seed: 2, year: 2026 });
  const grail = AutoCard.buildSpec(AutoCard.parseIntent('Aaron Judge superfractor auto relic rookie'), { seed: 2, year: 2026 });
  assert.equal(base.value.tier, 'Base');
  assert.equal(grail.value.tier, 'Grail');
  assert.ok(grail.value.odds > base.value.odds);
});

test('verified intel updates team and builds a stat table without inventing numbers', () => {
  const spec = AutoCard.buildSpec(AutoCard.parseIntent('Juan Soto'), { seed: 4, year: 2026 });
  const intel = {
    player: { fullName: 'Juan Soto', primaryPosition: 'RF' },
    seasons: [
      { season: 2024, team: 'New York Yankees', group: 'hitting', gamesPlayed: 157, hits: 166, homeRuns: 41, rbi: 109, avg: '.288' },
      { season: 2025, team: 'New York Mets', group: 'hitting', gamesPlayed: 160, homeRuns: 43 }
    ]
  };
  AutoCard.applyIntel(spec, intel);
  assert.equal(spec.team.abbr, 'NYM');
  const table = AutoCard.statRows(intel);
  assert.deepEqual(table.cols, ['YEAR', 'TEAM', 'G', 'H', 'HR', 'RBI', 'AVG']);
  assert.deepEqual(table.rows[0], ['2024', 'NYY', '157', '166', '41', '109', '.288']);
  assert.deepEqual(table.rows[1], ['2025', 'NYM', '160', '—', '43', '—', '—']);
  assert.equal(AutoCard.statRows(null), null);
});
