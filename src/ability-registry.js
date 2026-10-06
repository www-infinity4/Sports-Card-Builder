const ABILITIES = Object.freeze({
  visionBrowser: {
    id: 'vision_browser',
    engine: 'transformers.js',
    fork: 'www-infinity4/transformers.js',
    runtime: 'browser',
    tasks: ['image-classification','object-detection','segmentation','depth-estimation','zero-shot-object-detection']
  },
  segmentation: {
    id: 'segmentation',
    engine: 'SAM2',
    fork: 'www-infinity4/sam2',
    runtime: 'gpu-service',
    tasks: ['subject-mask','object-mask','video-mask-propagation']
  },
  workflow: {
    id: 'workflow',
    engine: 'ComfyUI',
    fork: 'www-infinity4/ComfyUI',
    runtime: 'gpu-service',
    tasks: ['workflow-graph','inpainting','outpainting','reference-conditioning','mask-compositing','upscaling','frame-interpolation']
  },
  imageGeneration: {
    id: 'image_generation',
    engine: 'FLUX via ComfyUI (Diffusers is a source reference only)',
    forks: ['www-infinity4/flux','www-infinity4/diffusers'],
    runtime: 'gpu-service',
    tasks: ['text-to-image','image-to-image','inpainting','controlled-generation']
  },
  autoCard: {
    id: 'auto_card',
    engine: 'Oracle Auto Card engine (public/auto-card.js)',
    runtime: 'browser',
    tasks: ['zero-input-build','intent-steering','set-parallel-rarity','serial-numbering','front-back-composition','artwork-fallback-chain']
  },
  videoGeneration: {
    id: 'video_generation',
    engine: 'Wan2.2',
    fork: 'www-infinity4/Wan2.2',
    runtime: 'gpu-service',
    tasks: ['text-to-video','image-to-video','text-image-to-video','character-animation']
  }
});

function getAbilities(env = process.env) {
  const configured = Boolean(
    env.ORACLE_COMFY_URL && env.ORACLE_FLUX_UNET && env.ORACLE_FLUX_CLIP_L &&
    env.ORACLE_FLUX_T5 && env.ORACLE_FLUX_VAE
  );
  return Object.fromEntries(Object.entries(ABILITIES).map(([key, ability]) => {
    const local = key === 'autoCard';
    const renderer = key === 'workflow' || key === 'imageGeneration';
    return [key, {
      ...ability,
      implemented: local || renderer,
      configured: local || (renderer && configured),
      status: local ? 'browser-ready' : renderer ? (configured ? 'configured-unverified' : 'not-configured') : 'reference-only',
      endpoint: renderer ? '/api/render/comfy' : null,
      healthEndpoint: renderer ? '/api/renderer/health' : null,
      implementedTasks: local ? ability.tasks : key === 'workflow' ? ['workflow-graph'] : key === 'imageGeneration' ? ['image-to-image'] : []
    }];
  }));
}

module.exports = { ABILITIES, getAbilities };
