const { buildCardSkeleton, buildGeminiPrompt } = require('./style-template');

const ROGERS_AI_URL = process.env.ROGERS_AI_URL || 'https://infinity-rogers.marvaseater.workers.dev/v1/chat';

function parseJsonFromText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch (_) {}
  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== '{') continue;
    let depth = 0;
    for (let end = start; end < trimmed.length; end += 1) {
      if (trimmed[end] === '{') depth += 1;
      if (trimmed[end] === '}') depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(trimmed.slice(start, end + 1)); }
        catch { break; }
      }
    }
  }
  return null;
}

async function generateCardWithRogers({ messages, subjectName, seriesKey }) {
  const prompt = buildGeminiPrompt(messages, subjectName, seriesKey);
  try {
    const res = await fetch(ROGERS_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        input: prompt,
        context: {
          application: 'Sports Card Builder',
          task: 'sports-card-generation',
          subjectName,
          seriesKey
        }
      }),
      signal: AbortSignal.timeout(18000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || ('Rogers AI HTTP ' + res.status));
    const text = String(data.output || data.output_text || data.answer || '').trim();
    const parsed = parseJsonFromText(text);
    if (parsed?.card) {
      parsed.card.styleAnchors = buildCardSkeleton(subjectName, [], seriesKey).styleAnchors;
      return parsed;
    }
    const card = buildCardSkeleton(subjectName, messages, seriesKey);
    return { reply: parsed?.reply || text || `Built a template-safe card draft for ${subjectName}.`, card };
  } catch (error) {
    const card = buildCardSkeleton(subjectName, messages, seriesKey);
    return {
      reply: `Rogers AI was unavailable, so a template-safe draft was built for ${subjectName}.`,
      warning: String(error.message || error),
      card
    };
  }
}

module.exports = {
  generateCardWithRogers,
  parseJsonFromText
};
