# Handoff

**Status**: ACTIVE
**From**: Claude (session 2026-10-08)
**To**: any next agent
**Date**: 2026-10-08
**Task**: Verify the reworked obstacle scanner on a real device (Samsung S23, serial R3CW10R310H)
**Plan files**: `docs/superpowers/specs/2026-10-08-frame-scan-design.md`, `docs/superpowers/specs/2026-10-08-depth-filter-design.md` (depth filter designed but NOT implemented, on hold)

---

## Current State (branch `feature/obstacle`)

The YUV problem from the 2026-08-12 handoff is long gone. `imagePreprocess.ts` decodes through `Photo.toImage()`.

Commits this session:
- `e8207ef`: box mapping uses the rotated image size (`photo.width/height` is the unrotated CameraX buffer). AreaRatio is weighted by how much of the central band the box covers. Object labels are hidden on the obstacle screen.
- `b911755`: `severitySmoother.ts`. A hazard needs 2 consecutive frames; a confirmed level is held for 2.5 s. Hazard confirmation moved out of the announcement policy. Trial thresholds are WARNING 0.06 / DANGER 0.15 (were 0.18 / 0.35).
- `da19caf`: frame-stream scanning (VisionCamera frame output, `pixelFormat:'rgb'`, physical rotation, worklet runs EfficientDet at ~6 FPS). Falls back to the capturePhoto loop after a 4 s watchdog or 5 worklet errors.

APK: `android/app/build/outputs/apk/release/app-release.apk`, built arm64-only with `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (60 MB; the universal build was 158 MB).

## Not verified yet

1. Frame mode on device. In `adb logcat | grep VVMETRIC`, `obstacle_frame` should show `source:"frame"` several times per second, `frame:"480x640"`, and no `obstacle_mode` fallback event.
2. The trial thresholds 0.06 / 0.15 need calibration from the `boxes` field of `obstacle_frame`.
3. App Check: the sideloaded release APK fails Play Integrity, so Gemini returns 401 "Firebase App Check token is invalid". The user unenforced Firebase AI Logic in the console, but at 12:05 it was still failing (possibly propagation delay). The fallback plan is a fixed debug token via `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN` in `.env.local` plus a rebuild.
4. `mapErrorKind` in `gemini.ts` maps any "fetch-error" (401/403/429) to `network`, so the app says "Không có kết nối mạng". Known, not fixed.

## Thesis documents (final_docs/, untracked)

The report, slides and talk script were updated for the band-coverage rule and hidden labels. They still describe thresholds 0.18 / 0.35, the 1 FPS still-photo loop and the policy-level 2-frame confirmation. Update them only after the device numbers are settled. Table 5.2 does not add up to 25 per condition; the user has to supply raw counts.
