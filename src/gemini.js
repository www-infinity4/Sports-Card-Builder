const { buildCardSkeleton, buildGeminiPrompt } = require('./style-template');

function parseJsonFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    for (let start = 0; start < trimmed.length; start += 1) {
      if (trimmed[start] !== '{') continue;

      let depth = 0;
      for (let end = start; end < trimmed.length; end += 1) {
        if (trimmed[end] === '{') depth += 1;
        if (trimmed[end] === '}') depth -= 1;

        if (depth === 0) {
          const candidate = trimmed.slice(start, end + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }

    return null;
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
