const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateCardWithRogers } = require('./gemini');
const { getReleasePlan } = require('./style-template');
const { getAbilities } = require('./ability-registry');
const { ComfyClient } = require('./comfy-client');
const { buildFluxImg2ImgWorkflow } = require('./comfy-workflow');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_REQUEST_BODY_BYTES = 12_000_000;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_SUBJECT_LENGTH = 120;
const MAX_SERIES_KEY_LENGTH = 120;


function parseDataUri(value) {
  const match = String(value || '').match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) throw new Error('invalid_image_data_uri');
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('empty_image_data');
  return { mimeType, buffer };
}

async function readJsonBody(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
  return await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error('request_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

function comfyConfigured() {
  return Boolean(
    process.env.ORACLE_COMFY_URL &&
    process.env.ORACLE_FLUX_UNET &&
    process.env.ORACLE_FLUX_CLIP_L &&
    process.env.ORACLE_FLUX_T5 &&
    process.env.ORACLE_FLUX_VAE
  );
}

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

  if (req.method === 'GET' && req.url === '/api/abilities') {
    return sendJson(res, 200, getAbilities());
  }


  if (req.method === 'GET' && req.url === '/api/renderer/health') {
    if (!comfyConfigured()) {
      return sendJson(res, 503, {
        ok: false,
        renderer: 'comfyui-flux',
        configured: false,
        error: 'renderer_not_configured'
      });
    }
    try {
      const client = new ComfyClient({ baseUrl: process.env.ORACLE_COMFY_URL, timeoutMs: 8000 });
      await client.request('/system_stats', { method: 'GET' });
      return sendJson(res, 200, { ok: true, renderer: 'comfyui-flux', configured: true });
    } catch (error) {
      return sendJson(res, 503, {
        ok: false,
        renderer: 'comfyui-flux',
        configured: true,
        error: String(error.message || error)
      });
    }
  }

  if (req.method === 'POST' && req.url === '/api/render/comfy') {
    try {
      if (!comfyConfigured()) {
        return sendJson(res, 503, { ok: false, error: 'renderer_not_configured' });
      }
      const body = await readJsonBody(req);
      const { buffer, mimeType } = parseDataUri(body.imageDataURI);
      const workflow = buildFluxImg2ImgWorkflow({
        prompt: String(body.prompt || ''),
        width: Number(body.width) || 768,
        height: Number(body.height) || 1024,
        denoise: Number(body.denoise ?? 0.28)
      });
      const client = new ComfyClient({
        baseUrl: process.env.ORACLE_COMFY_URL,
        timeoutMs: Number(process.env.ORACLE_COMFY_TIMEOUT_MS) || 150000
      });
      const output = await client.run({
        workflow,
        inputBuffer: buffer,
        inputFilename: 'oracle-subject.png',
        inputMimeType: mimeType
      });
      return sendJson(res, 200, {
        ok: true,
        renderer: 'comfyui-flux',
        promptId: output.promptId,
        dataURI: `data:${output.mimeType};base64,${output.buffer.toString('base64')}`
      });
    } catch (error) {
      return sendJson(res, 502, {
        ok: false,
        renderer: 'comfyui-flux',
        error: String(error.message || error)
      });
    }
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_REQUEST_BODY_BYTES) req.destroy();
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const messages = Array.isArray(parsed.messages)
          ? parsed.messages
              .filter((m) => m && typeof m.content === 'string')
              .map((m) => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content.slice(0, MAX_MESSAGE_LENGTH)
              }))
          : [];

        const subjectName = String(parsed.subjectName || 'Featured Card').slice(0, MAX_SUBJECT_LENGTH);
        const seriesKey = String(parsed.seriesKey || 'diamond-kings-2026').slice(0, MAX_SERIES_KEY_LENGTH);

        if (!messages.length) {
          return sendJson(res, 400, { error: 'At least one message is required.' });
        }

        const result = await generateCardWithRogers({
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
