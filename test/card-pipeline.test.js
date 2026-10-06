const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getAbilities } = require('../src/ability-registry');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '..', 'public', 'builder-tools.js'), 'utf8');

function loadSection(start, end, values = {}) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'app section exists');
  const context = vm.createContext({ console: { warn() {} }, ...values });
  vm.runInContext(app.slice(from, to), context);
  return context;
}

function createHarness(overrides = {}) {
  const window = {};
  vm.runInNewContext(tools, { window });
  const elements = {};
  const busy = [];
  const failedPlan = async () => { throw new Error('GPT unavailable'); };
  const values = {
    sourceFile: {}, referenceFile: {}, imageReadState: 'idle', lastVision: null,
    lastIntel: null, lastIntent: null, lastAbilityRoute: null,
    results: [], activeResult: -1, autoMode: false, autoBacks: new Map(),
    backResult: '', lastBlob: null, lastReferenceBlob: null, buildMode: '',
    lastTemplateRefs: [], lastDescription: '', lastPlan: null,
    BUILDER: window.OracleBuilderTools,
    $: id => elements[id] ||= { value: '1987 white border', style: {}, textContent: '' },
    setBusy: value => busy.push(value),
    showMonitor() {}, stage() {}, renderVariationBar() {}, renderSkillsPanel() {},
    activeTemplate: () => null, fetchTemplateReferences: async () => [],
    builderDescription: text => text, nextPaint: async () => {},
    buildDesignPlan: failedPlan, buildReferencePlan: failedPlan,
    buildCompactRecoveryPlan: failedPlan,
    renderCard: async () => ({ dataURI: 'finished-card' }),
    variationPrompt: (plan, _kind, index) => plan.renderPrompt + ' variation ' + index,
    iterateFinishedCardOnce: async finished => ({ finished, repaired: false }),
    showResult: async () => {},
    document: { querySelector: () => null },
    ...overrides
  };
  const context = loadSection('async function createCard(', 'const AUTO_CARD=', values);
  context.finishOutput = async out => {
    context.results.push(out.dataURI);
    return out.dataURI;
  };
  return { context, elements, busy };
}

test('Create Card reaches rendering when every GPT planning call fails', async () => {
  const { context, elements, busy } = createHarness();
  await context.createCard();
  assert.match(context.lastPlan.renderPrompt, /1987/);
  assert.match(context.lastPlan.renderPrompt, /white border/);
  assert.equal(context.lastPlan.planningSource, 'local-request');
  assert.equal(context.results.length, 1);
  assert.match(elements.status.innerHTML, /1 card created/);
  assert.deepEqual(busy, [true, false]);
});

test('reference builds invoke reference planning and retain both images on fallback', async () => {
  let referenceCalls = 0;
  const { context } = createHarness({
    buildReferencePlan: async () => {
      referenceCalls++;
      throw new Error('GPT unavailable');
    },
    buildDesignPlan: async () => { assert.fail('wrong planner'); }
  });
  await context.createCard(1, 'reference');
  assert.equal(referenceCalls, 2);
  assert.match(context.lastPlan.renderPrompt, /reference image 1/);
  assert.equal(context.lastReferenceBlob, context.referenceFile);
  assert.equal(context.results.length, 1);
});

test('planning fallback still works if builder tools did not load', async () => {
  const { context } = createHarness({ BUILDER: null });
  await context.createCard();
  assert.match(context.lastPlan.renderPrompt, /Preserve the exact uploaded subject/);
  assert.equal(context.results.length, 1);
});

test('three-card iteration completes with GPT unavailable', async () => {
  const { context, busy } = createHarness();
  await context.createCard(3);
  assert.equal(context.results.length, 3);
  assert.deepEqual(busy, [true, false]);
});

test('a second-card render failure still displays the first finished card', async () => {
  let renders = 0;
  let displayed;
  const { context, elements } = createHarness({
    renderCard: async () => {
      if (++renders === 2) throw new Error('second render unavailable');
      return { dataURI: 'first-card' };
    },
    showResult: async (index, options) => {
      displayed = index;
      assert.equal(options.review, false);
    }
  });
  await context.createCard(3);
  assert.equal(displayed, 0);
  assert.deepEqual(Array.from(context.results), ['first-card']);
  assert.match(elements.status.textContent, /1 finished card saved/);
});

test('planned ability routes do not claim that remote runtimes are active', () => {
  const window = {};
  const router = fs.readFileSync(path.join(__dirname, '..', 'public', 'ability-router.js'), 'utf8');
  vm.runInNewContext(router, { window });
  const route = window.OracleAbilityRouter.route();
  assert.equal(route.execution.active.length, 0);
  assert.equal(route.execution.planned.length, route.pipeline.length);
  assert.match(window.OracleAbilityRouter.buildCapabilityNote({}), /not proof of runtime availability/);
});

function renderHarness(overrides = {}) {
  return loadSection('async function renderCard(', 'async function nextPaint(', {
    fetchWithTimeout: async () => ({ ok: false, json: async () => ({}) }),
    renderWithWorkersAI: async () => { throw new Error('image provider unavailable'); },
    gptRenderRecovery: async () => { throw new Error('GPT unavailable'); },
    renderWithComfy: async () => ({ dataURI: 'comfy-card' }),
    ...overrides
  });
}

test('GPT recovery outage does not block alternate ComfyUI rendering', async () => {
  let prompt;
  const context = renderHarness({
    renderWithComfy: async (_blob, value) => {
      prompt = value;
      return { dataURI: 'comfy-card' };
    }
  });
  const out = await context.renderCard({}, 'locked prompt', 'request');
  assert.equal(prompt, 'locked prompt');
  assert.equal(out.dataURI, 'comfy-card');
});

test('healthy configured local ComfyUI is used before Workers AI', async () => {
  let endpoint;
  const context = renderHarness({
    fetchWithTimeout: async url => {
      assert.equal(url, '/api/renderer/health');
      return { ok: true, json: async () => ({ ok: true, configured: true }) };
    },
    renderWithComfy: async (_blob, _prompt, url) => {
      endpoint = url;
      return { dataURI: 'local-card' };
    },
    renderWithWorkersAI: async () => { assert.fail('local renderer should be preferred'); }
  });
  const out = await context.renderCard({}, 'locked prompt', 'request');
  assert.equal(endpoint, '/api/render/comfy');
  assert.equal(out.rendererPath, 'local-comfy-reference-image');
});

test('failed local ComfyUI render continues to Workers AI', async () => {
  const context = renderHarness({
    fetchWithTimeout: async () => ({ ok: true, json: async () => ({ ok: true, configured: true }) }),
    renderWithComfy: async () => { throw new Error('local job failed'); },
    renderWithWorkersAI: async () => ({ dataURI: 'workers-card' })
  });
  assert.equal((await context.renderCard({}, 'prompt', 'request')).dataURI, 'workers-card');
});

test('two-image builds never silently drop the design reference in ComfyUI', async () => {
  const context = renderHarness({
    fetchWithTimeout: async () => { assert.fail('single-image health path'); },
    renderWithComfy: async () => { assert.fail('single-image adapter'); }
  });
  await assert.rejects(context.renderCard({}, 'prompt', 'request', {}), /second design reference/);
});

function repairHarness(overrides = {}) {
  return loadSection('async function iterateFinishedCardOnce(', 'function variationPrompt(', {
    results: ['original'],
    lastPlan: { renderPrompt: 'locked prompt' }, lastDescription: 'request',
    lastBlob: {}, lastReferenceBlob: null,
    updateReviewPanel: async () => ({ blocking: true, qualityScore: 20, repairInstruction: 'repair crop' }),
    stage() {}, $: () => ({ textContent: '' }),
    renderCard: async () => ({ dataURI: 'repair' }),
    ...overrides
  });
}

test('repair render failures retain the completed original card', async () => {
  const context = repairHarness({ renderCard: async () => { throw new Error('repair failed'); } });
  const out = await context.iterateFinishedCardOnce('original');
  assert.equal(out.finished, 'original');
  assert.equal(out.repaired, false);
  assert.deepEqual(context.results, ['original']);
});

test('repair finishing failures retain the completed original card', async () => {
  const context = repairHarness({ finishOutput: async () => { throw new Error('image decode failed'); } });
  const out = await context.iterateFinishedCardOnce('original');
  assert.equal(out.repaired, false);
  assert.deepEqual(context.results, ['original']);
});

test('successful repairs replace the original only after finishing', async () => {
  const context = repairHarness();
  context.finishOutput = async () => {
    assert.deepEqual(context.results, ['original']);
    context.results.push('repaired');
    return 'repaired';
  };
  const out = await context.iterateFinishedCardOnce('original');
  assert.equal(out.repaired, true);
  assert.deepEqual(context.results, ['repaired']);
});

test('fork metadata distinguishes implemented adapters from source references', () => {
  const absent = getAbilities({});
  assert.equal(absent.workflow.status, 'not-configured');
  assert.equal(absent.autoCard.status, 'browser-ready');
  for (const key of ['visionBrowser', 'segmentation', 'videoGeneration']) {
    assert.equal(absent[key].status, 'reference-only');
    assert.equal(absent[key].implemented, false);
    assert.equal(absent[key].configured, false);
  }
  const configured = getAbilities({
    ORACLE_COMFY_URL: 'http://renderer.example',
    ORACLE_FLUX_UNET: 'unet', ORACLE_FLUX_CLIP_L: 'clip',
    ORACLE_FLUX_T5: 't5', ORACLE_FLUX_VAE: 'vae'
  });
  assert.equal(configured.workflow.status, 'configured-unverified');
  assert.equal(configured.imageGeneration.endpoint, '/api/render/comfy');
  assert.deepEqual(configured.imageGeneration.implementedTasks, ['image-to-image']);
  assert.equal(getAbilities({ ORACLE_COMFY_URL: 'http://renderer.example' }).workflow.configured, false);
});
