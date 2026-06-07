const { buildCardSkeleton, buildGeminiPrompt } = require('./style-template');

function parseJsonFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function generateCardWithGemini({ apiKey, model, messages, playerName }) {
  if (!apiKey) {
    const card = buildCardSkeleton(playerName, messages);
    return {
      reply: `Gemini key missing, returning template-safe draft for ${playerName}.`,
      card
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildGeminiPrompt(messages, playerName);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5 }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = parseJsonFromText(text);

  if (!parsed?.card) {
    const card = buildCardSkeleton(playerName, messages);
    return {
      reply: parsed?.reply || `Built a template-safe card draft for ${playerName}.`,
      card
    };
  }

  parsed.card.styleAnchors = buildCardSkeleton(playerName).styleAnchors;
  return parsed;
}

module.exports = {
  generateCardWithGemini,
  parseJsonFromText
};
