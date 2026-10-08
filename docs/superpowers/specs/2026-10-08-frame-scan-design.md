# Obstacle scan from the camera stream — design

Date: 2026-10-08 · Branch: `feature/obstacle` · Status: implemented, not yet verified on device

## Goal

Raise the obstacle scan rate from ~1 FPS (still-photo loop, `capturePhoto` ≈ 500 ms per frame) to ~6 FPS by reading frames from VisionCamera's frame output, so warnings fire earlier while walking. UI, speech, thresholds and the detection model stay the same.

## Pipeline

- `useFrameOutput({ targetResolution: OBSTACLE_FRAME_RESOLUTION, pixelFormat: 'rgb', enablePhysicalBufferRotation: true, dropFramesWhileBusy: true, onFrame })`. CameraX converts YUV to RGBA and rotates to portrait, so the worklet never decodes YUV, which was the cause of the first failed attempt.
- The `onFrame` worklet runs on the camera thread:
  1. It returns early unless the model is loaded and `isFrameScanEnabled` (a `createSynchronizable(boolean)`) is true.
  2. It throttles to `OBSTACLE_FRAME_PERIOD_MS` = 150 ms using `lastFrameRunAt` (a `createSynchronizable(number)`).
  3. `rgbaToSquareRgb` (`src/services/frameSampler.ts`) centre-crops, does a nearest-neighbour resize to 320×320 and drops alpha. This matches `imagePreprocess` in `'crop'` mode, so `parseDetections` maps boxes back the same way.
  4. It calls `model.runSync([input.buffer])`, copies the outputs to plain number arrays (fast-tflite reuses its output buffers), and sends them to JS with `scheduleOnRN`.
  5. It always calls `frame.dispose()` in `finally`. A frame that is not returned stalls CameraX, which matches the earlier "onFrame fired only once" symptom.
- On the JS thread, `processDetections` is shared by both sources. It runs `parseDetections` → `assessDetections` → `severitySmoother` → screen, `obstacle_frame` metric and announcement policy.

## Fallback

The still-photo loop stays in place and idles while the frame mode is active. The scanner switches one-way to the photo loop, and logs `obstacle_mode`, when either of these happens:

- the model is ready and no frame result arrives for `OBSTACLE_FRAME_WATCHDOG_MS` = 4 000 ms, either before the first result or after results stop;
- the worklet throws `OBSTACLE_FRAME_MAX_ERRORS` = 5 times in a row.

On fallback the worklet is disabled through the Synchronizable straight away, and the frame output is detached on the next render. The first photo cycle spends ~500 ms in `capturePhoto`, so any in-flight worklet inference finishes before the photo loop calls the model. fast-tflite has no interpreter lock.

`OBSTACLE_FRAME_MODE_ENABLED = false` restores the photo loop only.

## Logging

`obstacle_frame.source` is `'frame'` or `'photo'`. For frame-mode results `captureMs` and `decodeMs` are 0. `frame` reports the frame size: `480x640` confirms that physical rotation worked, while `640x480` means the frames are still landscape.

## Testing

- Unit tests for `rgbaToSquareRgb`: identity copy, portrait crop, landscape crop, centre sampling on downscale, and row padding.
- All existing suites and `yarn typecheck` pass.
- On device (manual), check logcat `VVMETRIC obstacle_frame` for:
  - `source:"frame"` arriving several times per second;
  - `frame:"480x640"`;
  - `prepMs`/`inferMs` values;
  - no `obstacle_mode` fallback.

## Known risks

- The GPU delegate may refuse to run on the camera thread. The worklet then throws and the scanner falls back to photos.
- Whether physical rotation applies to RGBA buffers on this device is unverified. If it does not, frames arrive landscape, detection quality drops, and no fallback triggers. The `frame` log field shows this.
- `babel.config.js` adds `react-native-worklets/plugin` explicitly while `babel-preset-expo` also adds it when installed. It was left unchanged.
