# Depth filter for obstacle detection — design

Date: 2026-10-08 · Branch: `feature/obstacle` · Status: experimental (the thesis treats depth as not implemented)

## Goal

Reduce false obstacle warnings a little by checking each EfficientDet detection against a monocular depth map. Depth may only **drop** a detection that looks far away. It never creates a warning, never raises a severity, never changes UI, and never adds speech or strings.

## Non-goals

- Detecting walls, doors or other non-COCO obstacles.
- Metric distance, or any change to `assessDetections`, the announcement policy, thresholds, screens or TTS.
- Updating the thesis report, slides or talk script.

## Model

- File: `assets/models/midas_small_256_fp16.tflite` (MiDaS v2.1 small, LiteRT fp16, MIT, 33 507 904 bytes, sha256 `bec9bce7…0890ca`), from `huggingface.co/litert-community/MiDaS-small`.
- Input: `1×256×256×3` float32 RGB, NHWC, ImageNet-normalised (mean 0.485/0.456/0.406, std 0.229/0.224/0.225 on 0–1 pixels).
- Output: `1×256×256` float32 relative inverse depth (bigger = nearer). Scale and shift are unknown per frame, so only ratios inside one frame are used.
- Loaded like EfficientDet: copied once to `Paths.document`, GPU delegate with CPU fallback, cached at module level.
- APK cost: +33.5 MB. Builds for testing use `-PreactNativeArchitectures=arm64-v8a`, which removes ~96 MB of unused native libraries, so the test APK is ~93 MB instead of 158 MB.

## Data flow per frame

1. Existing path unchanged: capture → `toImageAsync` → EfficientDet input → `parseDetections` → `objects`.
2. If the depth filter is enabled, the depth model is loaded, and `objects` is non-empty:
   a. Build the depth input from the same decoded image with the same centre-square crop as EfficientDet, resized to 256×256 and normalised.
   b. Run MiDaS → `depth: Float32Array` (256×256, covers the crop square).
   c. `filterByDepth(objects, depth, frameSize)` returns the objects to keep.
3. `assessDetections` runs on the kept objects, exactly as today.

Frames with no detections skip MiDaS entirely, so the common "đường trống" frame costs nothing extra.

## `filterByDepth` (pure, in `src/services/depthFilter.ts`)

- **Floor reference:** median depth of the square's bottom strip (rows from `OBSTACLE_DEPTH_FLOOR_TOP_RATIO` = 0.85 down to the bottom), columns inside the medium central band. This is the floor ahead of the user.
- **Box depth:** median depth inside the part of the box that lies in the crop square. A box entirely outside the square is kept unchanged.
- **Rule:** drop the box when `boxDepth / floorRef < OBSTACLE_DEPTH_FAR_RATIO` (initial 0.5: the box is much farther than the floor ahead). Otherwise keep it.
- **Fail open:** if `floorRef` is not a finite value above a small epsilon, keep every box. Bad depth must never hide an obstacle.
- Box coordinates are mapped into depth-map coordinates with the same crop geometry as `tfliteDetector.getBoxMapping` (`'crop'` mode), so both models describe the same square.

## Failure handling

- Depth model load fails → `console.warn('Lỗi khi nạp model độ sâu:', …)`, filter disabled for the session, scanning continues as today. No speech.
- Depth inference throws on a frame → warn, use the unfiltered `objects` for that frame. It does not count towards `OBSTACLE_MAX_DETECT_FAILURES`.
- `OBSTACLE_DEPTH_FILTER_ENABLED = false` in `config.ts` turns the whole feature off.

## Config (`src/constants/config.ts`)

`OBSTACLE_DEPTH_FILTER_ENABLED`, `DEPTH_MODEL_FILE_NAME`, `DEPTH_MODEL_SIZE_BYTES`, `DEPTH_MODEL_INPUT_SIZE` (256), `OBSTACLE_DEPTH_FAR_RATIO` (0.5), `OBSTACLE_DEPTH_FLOOR_TOP_RATIO` (0.85). The ImageNet mean/std arrays live next to the depth preprocessing as named constants.

## Logging

`obstacle_frame` gains `depthMs` (0 when skipped) and `dropped` (boxes removed by depth). Each entry in `boxes` gains ` d<ratio>` when a ratio was computed, so thresholds can be tuned from logcat.

## Files

- New: the model asset, `src/services/depthFilter.ts`, `src/services/__tests__/depthFilter.test.ts`.
- Changed: `config.ts`, `obstacleModel.ts` (generic loader shared by both models), `imagePreprocess.ts` (`imageToDepthInput`), `useObstacleScanner.ts`, `metrics.ts`.

## Testing

- Unit tests for `filterByDepth` with synthetic depth maps: far box dropped, near box kept, box at exactly the ratio kept, invalid floor reference keeps everything, box outside the crop square kept, coordinate mapping for a portrait frame.
- Existing suites, `yarn typecheck` and `git diff --check` must pass.
- Device check (manual): build an arm64 release APK and confirm in logcat that `depthMs` is reported, that frames without detections show `depthMs: 0`, and that boxes carry `d` ratios.

## Risks

- MiDaS output is affine-invariant, so the ratio is only a rough proxy. That is why the rule only drops boxes, defaults to a loose 0.5, and fails open.
- If the floor ahead is occluded by the obstacle itself, the reference becomes the obstacle, the ratio is ~1, and the box is kept, which is the safe outcome.
- Extra latency is unmeasured. The README reports 1–3 ms on a Pixel 8a GPU through LiteRT. fast-tflite with the GPU delegate may be slower, and JS normalisation of 196 608 floats adds time.
