# Handoff

**Status**: ACTIVE
**From**: Gemini (session 2026-08-12)
**To**: bất kỳ agent tiếp theo
**Date**: 2026-08-12
**Task**: Fix obstacle detection — TFLite EfficientDet-Lite0 không detect được vật cản
**Plan file**: không có (đang debug trực tiếp)

---

## Current State

- Branch `feature/rebuild-v2`
- Obstacle detection sử dụng `react-native-fast-tflite` + model EfficientDet-Lite0
- **Root cause đã xác định**: `Photo.getPixelBuffer()` trên Android trả về **YUV_420_888** format (KHÔNG phải RGBA). Code cũ treat như RGBA → model nhận rác → 0 detections.
- Đã thêm `yuvToRgbResized()` trong `useObstacleScanner.ts` để convert YUV→RGB + resize 320×320. **CHƯA XÁC NHẬN CHẠY ĐÚNG** — max score vẫn rất thấp (0.07-0.11), cần verify.

## Key Debug Data

```
# Trước fix (double sigmoid, treat as RGBA):
score range: min=0.0000 max=0.0742  → candidates=0, detections=0
# pixelBuffer size=19,444,498 cho photo 4000×3000
# RGBA sẽ là 48M, RGB=36M → đây là YUV_420_888 (~18M + padding)
```

## What Was Tried & Failed

1. **Double sigmoid** — Model output IS raw probabilities (0.0 - 0.07 range), not logits. Removing sigmoid didn't help.
2. **RGBA preprocessing** — `preprocessPixelBuffer()` treated buffer as RGBA (4 bytes/pixel) → wrong format.
3. **VisionCamera v5 `useFrameOutput` + frame processor** — Installed `react-native-vision-camera-worklets`, `react-native-worklets`, `vision-camera-resize-plugin`. Frame processor `onFrame` worklet **NEVER FIRED** (no logs). Likely API mismatch or configuration issue.
4. **`vision-camera-resize-plugin`** — compile error on Android (incompatible with VisionCamera v5).

## Current Architecture (after revert)

- `useObstacleScanner.ts` — back to `capturePhoto()` + `getPixelBuffer()` approach with **new `yuvToRgbResized()`** conversion
- `tfliteDetector.ts` — exports `parseDetections()` only (stateless). Model loaded via `useTensorflowModel` hook in scanner.
- `ObstacleModeScreen.tsx` — uses `setPhotoOutput` callback (original pattern)
- `CameraViewport.tsx` — original simple form (only photoOutput)

## Files Changed This Session

| File | Change |
|---|---|
| `src/hooks/useObstacleScanner.ts` | Rewrote: uses `useTensorflowModel` hook + `yuvToRgbResized()` |
| `src/services/tfliteDetector.ts` | Simplified: exports only `parseDetections()`, removed model loading |
| `src/screens/ObstacleModeScreen.tsx` | Reverted to photoOutput approach |
| `src/components/CameraViewport.tsx` | Reverted to original (no extraOutputs) |
| `App.tsx` | Removed `initTfliteModel()` call (model now via hook) |
| `babel.config.js` | **NEW** — `react-native-worklets/plugin` |
| `package.json` | Added: `react-native-worklets`, `react-native-vision-camera-worklets` |

## Packages Added (may want to remove unused)

- `react-native-vision-camera-worklets@5.2.2` — NOT working, can remove
- `react-native-worklets@0.11.3` — dependency of above, can remove
- `vision-camera-resize-plugin` — REMOVED (compile error)
- `react-native-worklets-core` — REMOVED

## What Needs To Be Done

### 1. Verify YUV→RGB conversion is correct
The `yuvToRgbResized()` function in `useObstacleScanner.ts` assumes NV21 format. Need to verify:
- Check if buffer is actually NV21 or NV12 (U/V byte order may be swapped)
- Check row stride calculation (estimated from buffer size)
- Add debug: log first few RGB pixel values after conversion to see if they look reasonable (0-255 range, not all zeros)

### 2. Alternative approaches to consider
- **Use `photo.path` + native image decoder** to get proper RGB pixels (avoid YUV parsing entirely)
- **Use lower-resolution photo capture** (e.g., `targetResolution: { width: 640, height: 480 }` on photoOutput) to reduce processing time and simplify stride calculation
- **Decode the buffer format** by logging first 4 bytes (check if it's JPEG `FF D8 FF` rather than raw YUV)

### 3. Once detection works
- Fine-tune `SCORE_THRESHOLD` (currently 0.35 in tfliteDetector.ts, also `OBSTACLE_SCORE_MIN` in config.ts)
- Remove debug logging (`frameCount < 50`)
- Clean up unused packages
- Commit all changes
- Update documentation

## Environment Notes

- Device: Samsung SM_S918N (Galaxy S23 Ultra)
- Build: `npx expo prebuild --clean --platform android && yarn android`
- Metro: `yarn start --reset-cache` (babel plugin change requires cache clear)
- iOS prebuild fails (missing RNWorklets pod) — only Android tested
- `minSdkVersion: 26` in app.json (required for HardwareBuffer)

## Open Questions

- Is `Photo.getPixelBuffer()` returning JPEG-compressed data instead of YUV? (buffer size 19.4M for 4000×3000 is ambiguous — could be high-quality JPEG)
- Could check first bytes: `FF D8 FF` = JPEG, otherwise raw YUV
- Why does `useFrameOutput` `onFrame` never fire? (installed all dependencies, Camera receives the output)
