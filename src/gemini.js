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

async function generateCardWithGemini({ apiKey, model, messages, subjectName, seriesKey }) {
  if (!apiKey) {
    const card = buildCardSkeleton(subjectName, messages, seriesKey);
    return {
      reply: `Gemini key missing, returning template-safe draft for ${subjectName}.`,
      card
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildGeminiPrompt(messages, subjectName, seriesKey);

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
    const card = buildCardSkeleton(subjectName, messages, seriesKey);
    return {
      reply: parsed?.reply || `Built a template-safe card draft for ${subjectName}.`,
      card
    };
  }

  parsed.card.styleAnchors = buildCardSkeleton(subjectName, [], seriesKey).styleAnchors;
  return parsed;
}

module.exports = {
  generateCardWithGemini,
  parseJsonFromText
};
