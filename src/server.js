const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateCardWithGemini } = require('./gemini');
const { getReleasePlan } = require('./style-template');

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const file = req.url === '/app.js' ? 'app.js' : 'index.html';
  const full = path.join(PUBLIC_DIR, file);
  fs.readFile(full, 'utf8', (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const contentType = file.endsWith('.js')
      ? 'application/javascript; charset=utf-8'
      : 'text/html; charset=utf-8';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/app.js')) {
    return serveStatic(req, res);
  }

  if (req.method === 'GET' && req.url === '/api/releases') {
    return sendJson(res, 200, getReleasePlan());
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const messages = Array.isArray(parsed.messages)
          ? parsed.messages
              .filter((m) => m && typeof m.content === 'string')
              .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content.slice(0, 3000)
              }))
          : [];

        const subjectName = String(parsed.subjectName || parsed.playerName || 'Featured Card').slice(0, 120);
        const seriesKey = String(parsed.seriesKey || 'diamond-kings-2026').slice(0, 120);

        if (!messages.length) {
          return sendJson(res, 400, { error: 'At least one message is required.' });
        }

        const result = await generateCardWithGemini({
          apiKey: GEMINI_API_KEY,
          model: GEMINI_MODEL,
          messages,
          subjectName,
          seriesKey
        });

        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 500, { error: error.message });
      }
    });

    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

if (require.main === module) {
  server.listen(PORT, () => {
    process.stdout.write(`Sports Card Builder running on http://localhost:${PORT}\n`);
  });
}

module.exports = { server };
