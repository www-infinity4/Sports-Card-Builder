const sendButton = document.getElementById('send');
const seriesSelect = document.getElementById('series');
const subjectInput = document.getElementById('subject');
const messageInput = document.getElementById('message');
const starterEl = document.getElementById('starter');
const chatEl = document.getElementById('chat');
const cardEl = document.getElementById('card');

const ROGERS_AI_URL = 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';

const RELEASE_PLAN = {
  series: {
    'topps-now-2026': { name: 'Topps Now 2026 – Daily Highlights', styleAnchors: ['Topps Chrome White Refractor','Silver geometric background','Blue on-card signature','Gold 1/1 stamp','Full game story on back'], defaultPalette:['white','silver','blue','gold'] },
    'diamond-kings-2026': { name: 'Diamond Kings 2026', styleAnchors: ['Painted oil-brush artwork','One player','One action image','Emotional facial expression','Natural swing angle','Bat directed toward a lower corner','Bat-barrel relic integrated into the barrel','Black-and-gold nameplate','Blue ink signature','Small foil 1/1 at bottom','Card number on back only','Consistent Diamond Kings framing'], defaultPalette:['gold','black','cream'] },
    'future-stars-2026': { name: 'Future Stars 2026', styleAnchors: ['Prospect-forward identity','White refractor premium finish'], defaultPalette:['white','silver','blue'] },
    'front-office-icons-2026': { name: 'Front Office Icons 2026', styleAnchors: ['Topps Executive Excellence','White platinum chrome','Executive profile on back','Team-building accomplishments'], defaultPalette:['white','platinum','silver'] },
    'pitching-excellence-2026': { name: 'Pitching Excellence 2026', styleAnchors: ['Pitching milestone focus','White refractor styling'], defaultPalette:['white','silver','ice-blue'] },
    'team-spotlight-2026': { name: 'Team Spotlight Cards', styleAnchors: ['Horizontal team-card layout','Team logos and scoreboards featured','Game recap on back'], defaultPalette:['team-color-primary','team-color-secondary','white'] }
  },
  starterWave: [
    'Dave Stieb - Most Underrated Pitcher of the 1980s',
    'Jacob deGrom — 100 Wins',
    'Orioles 6-Run First Inning Team Spotlight'
  ]
};

const messages = [];

function renderChat() {
  chatEl.textContent = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
}

function installReleasePlan(data = RELEASE_PLAN) {
  seriesSelect.innerHTML = '';
  Object.entries(data.series).forEach(([key, value]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = value.name;
    seriesSelect.appendChild(option);
  });
  seriesSelect.value = 'diamond-kings-2026';
  starterEl.textContent = data.starterWave.join('\n');
}

async function loadReleasePlan() {
  // Server-hosted builds may provide /api/releases. Static GitHub Pages builds do not.
  // Start with the bundled plan so the UI always works, then replace it only if JSON arrives.
  installReleasePlan(RELEASE_PLAN);
  try {
    const res = await fetch('./api/releases', { headers: { Accept: 'application/json' } });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('application/json')) return;
    const data = await res.json();
    if (data?.series && data?.starterWave) installReleasePlan(data);
  } catch (_) {
    // Bundled plan remains active.
  }
}

function cardSkeleton(subjectName, seriesKey) {
  const series = RELEASE_PLAN.series[seriesKey] || RELEASE_PLAN.series['diamond-kings-2026'];
  return {
    subject: subjectName || 'Featured Card',
    set: series.name,
    styleAnchors: series.styleAnchors,
    palette: series.defaultPalette,
    signature: 'Blue ink on-card style signature',
    numbering: 'Foil 1/1 on front, card number on back only',
    framing: 'Consistent set framing'
  };
}

function parseJsonFromText(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

async function generateWithRogers({ seriesKey, subjectName, messages }) {
  const series = RELEASE_PLAN.series[seriesKey] || RELEASE_PLAN.series['diamond-kings-2026'];
  const transcript = messages.map((m, i) => `${i + 1}. ${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const prompt = `You are the Sports Card Builder inside the Phi system.
Create one premium trading card design for: ${subjectName || 'Featured Card'}.
Series: ${series.name}.
Preserve these style anchors exactly:
- ${series.styleAnchors.join('\n- ')}

Conversation:
${transcript}

Return valid JSON only with keys reply and card.
The card object must contain subject, set, styleAnchors, palette, artworkDescription, relicPlacement, signature, foilMark, backNumberingNote, framingNotes, and finalDesignPrompt.`;

  const res = await fetch(ROGERS_AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      input: prompt,
      context: {
        application: 'Sports Card Builder',
        task: 'sports-card-generation',
        seriesKey,
        subjectName
      }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Rogers AI HTTP ${res.status}`);
  const parsed = parseJsonFromText(data.output || data.output_text || data.answer || '');
  if (parsed?.card) return parsed;
  return {
    reply: String(data.output || data.answer || 'Card generated.'),
    card: cardSkeleton(subjectName, seriesKey)
  };
}

async function generateCard(payload) {
  // Use the local Node API when this app is actually running behind its server.
  // On GitHub Pages that route returns HTML, so fall back cleanly to Rogers.
  try {
    const res = await fetch('./api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('application/json')) return await res.json();
  } catch (_) {}
  return generateWithRogers(payload);
}

sendButton.addEventListener('click', async () => {
  const content = messageInput.value.trim();
  if (!content) return;

  messages.push({ role: 'user', content });
  renderChat();
  sendButton.disabled = true;
  sendButton.textContent = 'Building…';

  try {
    const data = await generateCard({
      seriesKey: seriesSelect.value,
      subjectName: subjectInput.value.trim(),
      messages
    });
    if (data.error) {
      messages.push({ role: 'assistant', content: `Error: ${data.error}` });
    } else {
      messages.push({ role: 'assistant', content: data.reply || 'Card generated.' });
      cardEl.textContent = JSON.stringify(data.card || cardSkeleton(subjectInput.value.trim(), seriesSelect.value), null, 2);
    }
  } catch (error) {
    messages.push({ role: 'assistant', content: `Rogers AI error: ${error.message}` });
    cardEl.textContent = JSON.stringify(cardSkeleton(subjectInput.value.trim(), seriesSelect.value), null, 2);
  } finally {
    renderChat();
    messageInput.value = '';
    sendButton.disabled = false;
    sendButton.textContent = 'Generate Card';
  }
});

loadReleasePlan();
