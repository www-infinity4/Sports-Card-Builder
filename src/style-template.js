const LOCKED_ANCHORS = [
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

function paletteForPlayer(playerName = '') {
  const key = String(playerName).trim().toLowerCase();
  return PLAYER_PALETTES[key] || ['gold', 'black', 'cream'];
}

function buildCardSkeleton(playerName, history = []) {
  return {
    player: playerName,
    set: 'Diamond Kings Custom 1/1',
    styleAnchors: LOCKED_ANCHORS,
    palette: paletteForPlayer(playerName),
    relic: 'Real bat-barrel relic integrated into the painted bat barrel area',
    signature: 'Blue ink on-card style signature',
    numbering: 'Foil 1/1 on front, card number on back only',
    framing: 'Consistent Diamond Kings frame treatment',
    conversationContext: history.map((m) => `${m.role}: ${m.content}`)
  };
}

function buildGeminiPrompt(messages, playerName) {
  const transcript = messages
    .map((m, i) => `${i + 1}. ${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  return `You are a premium baseball card design assistant for a Diamond Kings-style custom 1/1 set.
Preserve these non-negotiable style anchors exactly on every design:\n- ${LOCKED_ANCHORS.join('\n- ')}

Use player-specific palettes when player name matches:
- Manzardo: red/navy/gold
- Abreu: silver/platinum
- Jazz: yellow/silver/gold/white/red
- Albies: blue/purple/yellow/white/green

Player requested: ${playerName}
Full chat transcript (read everything before responding):
${transcript}

Return valid JSON only (no markdown fences) with keys:
reply, card
where card contains: player, set, styleAnchors, palette, artworkDescription, relicPlacement, signature, foilMark, backNumberingNote, framingNotes, finalDesignPrompt.`;
}

module.exports = {
  LOCKED_ANCHORS,
  PLAYER_PALETTES,
  paletteForPlayer,
  buildCardSkeleton,
  buildGeminiPrompt
};
