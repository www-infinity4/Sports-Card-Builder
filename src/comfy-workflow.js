'use strict';

function env(name,fallback=''){
  return String(process.env[name]||fallback).trim();
}

function buildFluxImg2ImgWorkflow({prompt,width=768,height=1024,denoise=0.30,seed}={}){
  const unet=env('ORACLE_FLUX_UNET');
  const clipL=env('ORACLE_FLUX_CLIP_L');
  const t5=env('ORACLE_FLUX_T5');
  const vae=env('ORACLE_FLUX_VAE');
  if(!unet||!clipL||!t5||!vae){
    const missing=[
      !unet&&'ORACLE_FLUX_UNET',
      !clipL&&'ORACLE_FLUX_CLIP_L',
      !t5&&'ORACLE_FLUX_T5',
      !vae&&'ORACLE_FLUX_VAE'
    ].filter(Boolean);
    throw new Error('flux_models_not_configured:'+missing.join(','));
  }

  const safePrompt=[
    'Use the input image as the identity and composition source.',
    'Preserve the same people, faces, bodies, clothing, objects and scene unless the user explicitly asks otherwise.',
    'Do not invent or substitute a different person.',
    'Do not render any words, names, logos, card numbers, serial numbers, captions or pseudo-text.',
    String(prompt||'').trim()
  ].join(' ');

  return {
    '1':{class_type:'LoadImage',inputs:{image:'__ORACLE_INPUT__'}},
    '2':{class_type:'UNETLoader',inputs:{unet_name:unet,weight_dtype:'default'}},
    '3':{class_type:'DualCLIPLoader',inputs:{clip_name1:clipL,clip_name2:t5,type:'flux',device:'default'}},
    '4':{class_type:'VAELoader',inputs:{vae_name:vae}},
    '5':{class_type:'CLIPTextEncode',inputs:{text:safePrompt,clip:['3',0]}},
    '6':{class_type:'FluxGuidance',inputs:{guidance:3.2,conditioning:['5',0]}},
    '7':{class_type:'CLIPTextEncode',inputs:{text:'text letters words logos watermark extra people changed face different person deformed hands',clip:['3',0]}},
    '8':{class_type:'VAEEncode',inputs:{pixels:['1',0],vae:['4',0]}},
    '9':{class_type:'KSampler',inputs:{
      seed:Number.isFinite(seed)?seed:Math.floor(Math.random()*2147483647),
      steps:28,cfg:1,sampler_name:'euler',scheduler:'simple',denoise:Math.max(.08,Math.min(.55,Number(denoise)||.30)),
      model:['2',0],positive:['6',0],negative:['7',0],latent_image:['8',0]
    }},
    '10':{class_type:'VAEDecode',inputs:{samples:['9',0],vae:['4',0]}},
    '11':{class_type:'ImageScale',inputs:{image:['10',0],upscale_method:'lanczos',width:Number(width)||768,height:Number(height)||1024,crop:'disabled'}},
    '12':{class_type:'SaveImage',inputs:{filename_prefix:'OracleCard',images:['11',0]}}
  };
}

module.exports={buildFluxImg2ImgWorkflow};
