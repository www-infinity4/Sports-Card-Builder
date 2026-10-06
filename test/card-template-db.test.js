const test = require('node:test');
const assert = require('node:assert/strict');

const DB = require('../public/card-template-db.js');

test('database covers major makers, years and entertainment cards', () => {
  const makers = DB.makers();
  for (const m of ['Topps', 'Upper Deck', 'Donruss', 'Fleer', 'Bowman', 'Score', 'Panini']) assert.ok(makers.includes(m), m);
  assert.ok(DB.list({ maker: 'Topps', category: 'sports' }).length >= 20);
  assert.ok(DB.list({ category: 'movie' }).length >= 5);
  assert.ok(DB.list({ category: 'tv' }).length >= 4);
  const ids = new Set(DB.TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, DB.TEMPLATES.length, 'unique ids');
  for (const t of DB.TEMPLATES) {
    assert.ok(DB.LAYOUTS[t.layout], t.id + ' layout');
    assert.ok(DB.CATEGORIES[t.category], t.id + ' category');
    assert.ok(DB.referenceQuery(t).includes(String(t.year)));
  }
});

test('match picks maker + year, tolerates typos and lines', () => {
  assert.equal(DB.match('make it a 1987 Topps card').id, 'topps-1987');
  assert.equal(DB.match('dobruss diamond kings').id, 'donruss-diamond-kings');
  assert.equal(DB.match('Topps chrome refractor').id, 'topps-chrome');
  assert.equal(DB.match('1977 star wars').id, 'topps-star-wars-1977');
  assert.equal(DB.match('upper deck 1989').id, 'upperdeck-1989');
  assert.equal(DB.match('1989 batman').id, 'topps-batman-1989');
  assert.equal(DB.match('1966 batman').id, 'topps-batman-1966');
  assert.equal(DB.match('just a nice photo'), null);
  assert.equal(DB.match('batman', { category: 'movie' }).category, 'movie');
});

test('category detection separates sports, movies and tv', () => {
  assert.equal(DB.detectCategory({ keywords: ['baseball', 'player', 'stadium'] }), 'sports');
  assert.equal(DB.detectCategory({ text: 'Batman movie still from Warner film' }), 'movie');
  assert.equal(DB.detectCategory({ text: 'sitcom episode on NBC television' }), 'tv');
  assert.equal(DB.detectCategory({ category: 'tv', text: 'baseball' }), 'tv');
  assert.equal(DB.detectCategory({}), 'other');
  assert.equal(DB.defaultFor('movie').category, 'movie');
});

test('front layout puts brand on top, name plate and 1/1 in the lower right', () => {
  const W = 750, H = 1050;
  for (const t of DB.TEMPLATES) {
    const l = DB.frontLayout(W, H, t);
    assert.ok(l.brand.y < H * 0.15, 'brand spot at top');
    assert.ok(l.nameplate.x + l.nameplate.w <= W && l.nameplate.x > W * 0.15, 'name plate right side');
    assert.ok(l.nameplate.y + l.nameplate.h <= H && l.nameplate.y > H * 0.75, 'name plate lower');
    assert.ok(l.serial.x + l.serial.w <= W && l.serial.x > W / 2, '1/1 right side');
    assert.ok(l.serial.y + l.serial.h <= l.nameplate.y, '1/1 sits above name plate');
  }
});

test('cleanField removes labels, symbols and excess words', () => {
  assert.equal(DB.cleanField('Title: "Aaron Judge"'), 'Aaron Judge');
  assert.equal(DB.cleanField('MGM™'), 'MGM');
  assert.equal(DB.cleanField('Aaron Judge - New York Yankees right fielder in the 2024 season', 4), 'Aaron Judge');
  assert.ok(DB.cleanField('one two three four five six seven eight nine', 6).split(' ').length <= 6);
  assert.equal(DB.cleanField(''), '');
});

test('template prompt forbids rendered text and reserves the layout spots', () => {
  const p = DB.promptFor(DB.get('topps-1987'));
  assert.match(p, /1987 Topps/);
  assert.match(p, /lower-right corner clear/);
  assert.match(p, /Do not draw any text/);
});
