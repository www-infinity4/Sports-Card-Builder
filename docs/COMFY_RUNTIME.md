# Oracle GPU Renderer

This folder turns the forked open-source engines into an executable renderer path.

## Runtime

The Sports Card Builder Node service can now talk to a running ComfyUI instance using its native API:

1. upload the exact source image to `/upload/image`
2. queue a workflow to `/prompt`
3. poll `/history/{prompt_id}`
4. fetch the result from `/view`

The first workflow is FLUX image-to-image with low denoise so the uploaded subject stays authoritative.

## Required environment

```
ORACLE_COMFY_URL=http://127.0.0.1:8188
ORACLE_FLUX_UNET=flux1-dev-fp8.safetensors
ORACLE_FLUX_CLIP_L=clip_l.safetensors
ORACLE_FLUX_T5=t5xxl_fp16.safetensors
ORACLE_FLUX_VAE=ae.safetensors
```

Use the actual filenames installed in the ComfyUI model directories.

## Important

A GitHub fork provides code, not GPU execution. The above variables only become live when ComfyUI is running on a GPU host. The website must not pretend these engines are active before `ORACLE_COMFY_URL` is reachable.

ComfyUI is GPL-3.0; keep it as a separate runtime/service and call its HTTP API rather than copying its implementation into the card builder.
