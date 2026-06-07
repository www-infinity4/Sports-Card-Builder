const DIAMOND_KINGS_ANCHORS = [
  'Painted oil-brush artwork',
  'One player',
  'One action image',
  'Emotional facial expression',
  'Natural swing angle',
  'Bat directed toward a lower corner',
  'Bat-barrel relic integrated into the barrel',
  'Black-and-gold nameplate',
  'Blue ink signature',
  'Small foil 1/1 at bottom',
  'Card number on back only',
  'Consistent Diamond Kings framing'
];

const PLAYER_PALETTES = {
  manzardo: ['red', 'navy', 'gold'],
  abreu: ['silver', 'platinum'],
  jazz: ['yellow', 'silver', 'gold', 'white', 'red'],
  albies: ['blue', 'purple', 'yellow', 'white', 'green']
};

const RELEASE_SERIES = {
  'topps-now-2026': {
    name: 'Topps Now 2026 – Daily Highlights',
    styleAnchors: [
      'Topps Chrome White Refractor',
      'Silver geometric background',
      'Blue on-card signature',
      'Gold 1/1 stamp',
      'Full game story on back'
    ],
    featuredCards: [
      'Andrew Vaughn — HR in 8th (6/5)',
      'Roki Sasaki — 9 Strikeouts',
      'Freddie Freeman — Home Run',
      'Travis Bazzana — RBI Game',
      'Hunter Goodman — 15th HR',
      'Shohei Ohtani — 243rd HR since 2021',
      'Brandon Lowe — Home Run',
      'Jake Bauers — 3-Run HR',
      'Julio Rodríguez — Home Run',
      'Wilyer Abreu — Home Run',
      'Gleyber Torres — Tigers HR',
      'Joe Mack — First MLB Home Run',
      'Marcus Semien — Home Run',
      'Tommy Troy — Home Run',
      'Ketel Marte — 2-Run HR',
      'Nolan Arenado — Home Run',
      'Miguel Vargas — Home Run',
      'Colt Emerson — 3rd Career Home Run',
      'Jose Siri — Grand Slam'
    ],
    defaultPalette: ['white', 'silver', 'blue', 'gold'],
    relic: 'Set-specific premium memorabilia placement',
    framing: 'Consistent set framing'
  },
  'diamond-kings-2026': {
    name: 'Diamond Kings 2026',
    styleAnchors: DIAMOND_KINGS_ANCHORS,
    featuredCards: [
      'Sal Stewart',
      'Kyle Manzardo',
      'Aaron Judge',
      'Juan Soto',
      'Ronald Acuña Jr.',
      'Bryce Harper',
      'Jett Williams',
      'Mike Sirota',
      'George Lombard Jr.',
      'Charlie Condon',
      'Cole Young',
      'Hao-Yu Lee',
      'Jac Caglianone',
      'Luisangel Acuña',
      'Junior Caminero'
    ],
    defaultPalette: ['gold', 'black', 'cream'],
    relic: 'Real bat-barrel relic integrated into the painted bat barrel area',
    framing: 'Consistent Diamond Kings frame treatment'
  },
  'future-stars-2026': {
    name: 'Future Stars 2026',
    styleAnchors: ['Prospect-forward identity', 'White refractor premium finish'],
    featuredCards: [
      'Connor Prielipp',
      'Cam Schlittler',
      'Seth Hernandez',
      'Gage Wood',
      'Ben Hess',
      'River Ryan',
      'Elmer Rodriguez-Cruz',
      'Dan Kirby',
      'Noah Cameron',
      'Mason Edwards',
      'Gage Jump',
      'Taylor Pannell'
    ],
    defaultPalette: ['white', 'silver', 'blue'],
    relic: 'Set-specific premium memorabilia placement',
    framing: 'Consistent set framing'
  },
  'front-office-icons-2026': {
    name: 'Front Office Icons 2026',
    styleAnchors: [
      'Topps Executive Excellence',
      'White platinum chrome',
      'Executive profile on back',
      'Team-building accomplishments'
    ],
    featuredCards: [
      'Alex Anthopoulos',
      'Erik Neander',
      'Matt Arnold',
      'Chris Getz',
      'Ben Cherington',
      'Chaim Bloom',
      'Paul Toboni',
      'A. J. Preller',
      'Brian Cashman'
    ],
    defaultPalette: ['white', 'platinum', 'silver'],
    relic: 'Set-specific premium memorabilia placement',
    framing: 'Consistent set framing'
  },
  'pitching-excellence-2026': {
    name: 'Pitching Excellence 2026',
    styleAnchors: ['Pitching milestone focus', 'White refractor styling'],
    featuredCards: [
      'Jacob deGrom — 100 Wins',
      'Ranger Suárez',
      'Kyle Harrison — 12 Strikeouts',
      'Noah Cameron',
      'Roki Sasaki',
      'Bryan Woo',
      'Mason Edwards',
      'Gage Jump'
    ],
    defaultPalette: ['white', 'silver', 'ice-blue'],
    relic: 'Set-specific premium memorabilia placement',
    framing: 'Consistent set framing'
  },
  'team-spotlight-2026': {
    name: 'Team Spotlight Cards',
    styleAnchors: [
      'Horizontal team-card layout',
      'Team logos and scoreboards featured',
      'Game recap on back'
    ],
    featuredCards: [
      'Orioles 6-run first inning',
      'Reds beat Royals',
      'Brewers 7-run inning',
      'Rockies 5-run inning',
      'Marlins hot streak (6/1–6/3 range)',
      'Reds comeback led by Will Benson'
    ],
    defaultPalette: ['team-color-primary', 'team-color-secondary', 'white'],
    relic: 'Set-specific premium memorabilia placement',
    framing: 'Consistent set framing'
  }
};

const STARTER_WAVE = [
  'Dave Stieb — Most Underrated Pitcher of the 1980s',
  'Jacob deGrom — 100 Wins',
  'Orioles 6-Run First Inning Team Spotlight'
];

function paletteForPlayer(playerName = '', seriesKey = 'diamond-kings-2026') {
  const series = RELEASE_SERIES[seriesKey] || RELEASE_SERIES['diamond-kings-2026'];
  const key = String(playerName).trim().toLowerCase();
  return PLAYER_PALETTES[key] || series.defaultPalette;
}

function getSeries(seriesKey = 'diamond-kings-2026') {
  return RELEASE_SERIES[seriesKey] || RELEASE_SERIES['diamond-kings-2026'];
}

function buildCardSkeleton(subjectName, history = [], seriesKey = 'diamond-kings-2026') {
  const series = getSeries(seriesKey);
  return {
    subject: subjectName,
    set: series.name,
    styleAnchors: series.styleAnchors,
    palette: paletteForPlayer(subjectName, seriesKey),
    relic: series.relic,
    signature: 'Blue ink on-card style signature',
    numbering: 'Foil 1/1 on front, card number on back only',
    framing: series.framing,
    conversationContext: history.map((m) => `${m.role}: ${m.content}`)
  };
}

function buildGeminiPrompt(messages, subjectName, seriesKey = 'diamond-kings-2026') {
  const series = getSeries(seriesKey);
  const transcript = messages
    .map((m, i) => `${i + 1}. ${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  return `You are a premium baseball card design assistant.
Build a card in the "${series.name}" release.
Preserve these series anchors exactly:\n- ${series.styleAnchors.join('\n- ')}

Diamond Kings fixed anchors to prevent style drift:\n- ${DIAMOND_KINGS_ANCHORS.join('\n- ')}

Use player-specific Diamond Kings palettes when player name matches:
- Manzardo: red/navy/gold
- Abreu: silver/platinum
- Jazz: yellow/silver/gold/white/red
- Albies: blue/purple/yellow/white/green

Subject requested: ${subjectName}
Known cards in this series:\n- ${series.featuredCards.join('\n- ')}

Full chat transcript (read everything before responding):
${transcript}

Return valid JSON only (no markdown fences) with keys:
reply, card
where card contains: subject, set, styleAnchors, palette, artworkDescription, relicPlacement, signature, foilMark, backNumberingNote, framingNotes, finalDesignPrompt.`;
}

function getReleasePlan() {
  return {
    series: RELEASE_SERIES,
    starterWave: STARTER_WAVE
  };
}

module.exports = {
  DIAMOND_KINGS_ANCHORS,
  PLAYER_PALETTES,
  RELEASE_SERIES,
  STARTER_WAVE,
  paletteForPlayer,
  buildCardSkeleton,
  buildGeminiPrompt,
  getReleasePlan
};
