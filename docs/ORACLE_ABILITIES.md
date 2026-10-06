# Oracle Builder Abilities

This project uses the user's GitHub forks as the canonical open-source capability references.

## Forks scanned

- `www-infinity4/ComfyUI` — workflow/orchestration. GPL-3.0. Keep as a separable service/runtime boundary rather than copying its implementation into the Apache-style adapters.
- `www-infinity4/diffusers` — modular diffusion pipelines. Apache-2.0.
- `www-infinity4/sam2` — image/video segmentation. Apache-2.0.
- `www-infinity4/flux` — FLUX inference code. Apache-2.0 code repository; model/checkpoint licenses must be checked independently.
- `www-infinity4/Wan2.2` — image/video generation and animation. Apache-2.0 code repository; model/checkpoint licenses must be checked independently.
- `www-infinity4/transformers.js` — browser-side vision and multimodal inference. Apache-2.0.

## Runtime design

Oracle does **not** vendor these entire repositories into Sports-Card-Builder.

The intended fork capabilities are:

1. **Reader** — Transformers.js for browser-safe inspection.
2. **Masker** — SAM2 for precise subject/object segmentation.
3. **Workflow engine** — ComfyUI for reproducible node graphs, masks, inpainting, reference conditioning, upscaling and frame interpolation.
4. **Card renderer** — FLUX through Diffusers/ComfyUI.
5. **Animator** — Wan2.2 for card/video motion.
6. **Validator** — Oracle compares the output against semantic hard locks before acceptance.

GPU-heavy engines require a GPU runtime reachable by an adapter. A GitHub fork supplies source code, not free compute. The browser app therefore treats those engines as capabilities with explicit runtime requirements.

## Integration audit

The October 6, 2026 audit enumerated 133 public forks belonging to `www-infinity4` and confirmed all six fork names above. Not all forks are relevant to card creation, and being listed here does not make a fork executable.

- **ComfyUI:** an executable HTTP adapter and deployment definition exist. It uploads a subject, submits a workflow, polls completion and retrieves the result.
- **FLUX:** the adapter uses configured FLUX checkpoints through native ComfyUI nodes, not a direct installation of the `flux` fork.
- **Diffusers, SAM2, Transformers.js and Wan2.2:** source references only; no direct executable adapter exists in this app.
- **Other relevant forks:** PaddleOCR, GroundingDINO, segment-anything, opencv, ultralytics, Depth-Anything-3, open_clip, tfjs-models, LTX-Video, Hunyuan3D-2.1, TRELLIS.2, FFmpeg, ffmpeg.wasm, remotion, og-image, three.js, searxng, playwright, c2pa-js and fonttools were found, but are not directly integrated here. External Worker reader, search and browser-inspection calls do not prove those Workers use these forks.

`GET /api/abilities` reports `implemented`, `configured`, `status`, `implementedTasks`, and adapter/health endpoints. Configured does **not** mean healthy; verify `/api/renderer/health` on the deployed host. No GPU deployment was confirmed operational by this audit.

Create Card can compile its locked request with the existing browser builder tools if all GPT planning attempts fail. This is a renderer prompt fallback, not fabricated card data or replacement artwork. Automatic repair failures retain the original finished card.

## Licensing boundary

ComfyUI is GPL-3.0. Keep ComfyUI as an independent service/runtime and communicate over its API.

Diffusers, SAM2, FLUX code, Wan2.2 code, and Transformers.js are Apache-2.0. Model weights can have licenses different from their source repositories; inspect the selected checkpoint before production use.

## Next adapter endpoints

Recommended service contract:

- `POST /v1/vision/inspect`
- `POST /v1/vision/segment`
- `POST /v1/workflow/card`
- `POST /v1/render/card`
- `POST /v1/render/animate`
- `POST /v1/validate/card`

Each request should carry `build_spec`, `ability_route`, subject/reference assets, and an idempotency key.
