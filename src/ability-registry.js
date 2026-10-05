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
    engine: 'FLUX + Diffusers',
    forks: ['www-infinity4/flux','www-infinity4/diffusers'],
    runtime: 'gpu-service',
    tasks: ['text-to-image','image-to-image','inpainting','controlled-generation']
  },
  videoGeneration: {
    id: 'video_generation',
    engine: 'Wan2.2',
    fork: 'www-infinity4/Wan2.2',
    runtime: 'gpu-service',
    tasks: ['text-to-video','image-to-video','text-image-to-video','character-animation']
  }
});

function getAbilities() {
  return ABILITIES;
}

module.exports = { ABILITIES, getAbilities };
