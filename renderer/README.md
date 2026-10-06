# Oracle Renderer Deployment

This directory is the executable GPU side of Sports Card Builder.

It uses your fork of ComfyUI as the workflow runtime and the Sports Card Builder Node service as the API adapter.

## What is actually wired

- source image upload -> ComfyUI `/upload/image`
- FLUX image-to-image workflow -> ComfyUI `/prompt`
- job completion -> `/history/{prompt_id}`
- result retrieval -> `/view`
- browser -> Cloudflare `/v1/comfy-image` -> Oracle renderer `/api/render/comfy`

## Models

Place the configured model files in the normal ComfyUI model folders mounted under `renderer/models`.

The defaults expect:

- `models/unet/flux1-dev-fp8.safetensors`
- `models/clip/clip_l.safetensors`
- `models/clip/t5xxl_fp16.safetensors`
- `models/vae/ae.safetensors`

If filenames differ, set the environment variables in `.env`.

## Run

On an NVIDIA GPU host with Docker Compose:

```bash
cd renderer
cp .env.example .env
docker compose up --build
```

Then expose the Oracle API service publicly over HTTPS and set the Cloudflare Worker secret:

```
ORACLE_RENDERER_URL=https://your-renderer-host.example
```

The browser already prefers `/v1/comfy-image`. Once the secret points to this service, ComfyUI/FLUX becomes the first renderer automatically.

## Why the GPU host matters

The GitHub forks are source code. They do not run inside GitHub Pages, and the ChatGPT OpenArt/Runway connections do not grant the website API credentials. A reachable GPU process is the last runtime dependency.
