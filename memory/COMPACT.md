# Compact Context

> **Agent**: Read this FIRST on session start. Max 30 lines.
> **Update**: Agent refreshes this every session end.

## Project

VisionVoice v2 — Expo dev client · RN · TS strict · RNFB (Gemini qua Firebase AI Logic + App Check, project `visionvoice-app-2026`) · EfficientDet-Lite0/TFLite obstacle loop · react-navigation 4 màn · half-duplex audio. App tiếng Việt cho người khiếm thị: mô tả ảnh, hỏi đáp giọng nói, cảnh báo vật cản. GRIT/ngrok đã xoá khỏi runtime và được giữ làm baseline đánh giá.

## Active Task

**Fix obstacle detection** — TFLite EfficientDet-Lite0 chạy nhưng trả 0 detections. Root cause: `Photo.getPixelBuffer()` trên Android trả YUV_420_888 (không phải RGBA). Đã thêm `yuvToRgbResized()` nhưng CHƯA XÁC NHẬN score range cải thiện. **ĐỌC `memory/handoff.md` CHI TIẾT TRƯỚC KHI LÀM.**

## Critical Rules (top 5 lessons)

1. **Vietnamese is the user-facing language.** All UI text, TTS phrases, and voice keywords are Vietnamese; code identifiers stay English.
2. **No magic values in components.** URLs, timeouts, locales, keywords, canned phrases all live in `src/constants/config.ts` as `UPPER_SNAKE_CASE`.
3. **Accessibility is the product.** Every touchable needs `accessibilityLabel` + `accessibilityHint`; every state change gets audio (`Speech.speak`) and haptic feedback.
4. **Structure**: screens use `export default function`; services/hooks/constants use named exports. `StyleSheet.create` at file bottom, dark palette (`#07070E` bg, `#6366F1` accent). No barrel files — direct relative imports.
5. **Errors never break the flow**: `console.warn('Lỗi khi ...:', e)`, then speak a Vietnamese fallback and call `resetState()`.

## Blockers

- Obstacle detection: pixel buffer format (YUV vs JPEG?) chưa 100% confirmed — cần log first bytes
- Packages thừa trong package.json: `react-native-vision-camera-worklets`, `react-native-worklets` (frame processor approach failed)
- iOS prebuild fails (missing RNWorklets pod) — chỉ Android hoạt động
- `babel.config.js` mới tạo với `react-native-worklets/plugin` — cần `--reset-cache` khi start Metro

## Last Session

2026-08-12 — Debug obstacle detection. Discovered `Photo.getPixelBuffer()` returns YUV on Android (not RGBA). Tried frame processor approach (`useFrameOutput`) — onFrame never fired. Reverted to capturePhoto + YUV→RGB conversion. Model loads via `useTensorflowModel` hook (moved from App.tsx init). Score range still very low (max 0.07). Need to verify YUV conversion or check if buffer is actually JPEG.
