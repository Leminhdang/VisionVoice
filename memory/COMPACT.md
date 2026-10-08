# Compact Context

> **Agent**: Read this FIRST on session start. Max 30 lines.
> **Update**: Agent refreshes this every session end.

## Project

VisionVoice v2 — Expo SDK 56 dev client · RN 0.85.3 · TypeScript 6 strict · RNFB (Gemini qua Firebase AI Logic + App Check, project `visionvoice-app-2026`) · EfficientDet-Lite0/TFLite obstacle loop · react-navigation 4 màn · half-duplex audio. App tiếng Việt cho người khiếm thị: mô tả ảnh, hỏi đáp giọng nói, cảnh báo vật cản. GRIT/ngrok đã xoá khỏi runtime và được giữ làm baseline đánh giá.

## Active Task

**Verify the reworked obstacle scanner on the S23.** It now uses frame-stream scanning at ~6 FPS with a photo fallback, a severity smoother and trial thresholds of 0.06 / 0.15. **Read `memory/handoff.md` first.**

## Critical Rules (top 5 lessons)

1. **Vietnamese is the user-facing language.** All UI text, TTS phrases, and voice keywords are Vietnamese; code identifiers stay English.
2. **No magic values in components.** URLs, timeouts, locales, keywords, canned phrases all live in `src/constants/config.ts` as `UPPER_SNAKE_CASE`.
3. **Accessibility is the product.** Every touchable needs `accessibilityLabel` + `accessibilityHint`; every state change gets audio (`Speech.speak`) and haptic feedback.
4. **Structure**: screens use `export default function`; services/hooks/constants use named exports. `StyleSheet.create` at file bottom, dark palette (`#07070E` bg, `#6366F1` accent). No barrel files — direct relative imports.
5. **Errors never break the flow**: `console.warn('Lỗi khi ...:', e)`, then speak a Vietnamese fallback and call `resetState()`.

## Blockers

- Gemini 401 on the sideloaded release APK (App Check / Play Integrity). Either unenforce it in the console or use a fixed debug token.
- Frame mode and the new thresholds are not yet verified on a device.
- iOS prebuild is untested on this branch.

## Last Session

2026-10-08: Fixed corridor false alarms (rotated frame size, band-coverage weighting), hid object labels, added the severity smoother and frame-stream scanning. Updated the thesis docx, pptx and talk script in final_docs/. Built an arm64 APK (60 MB).
