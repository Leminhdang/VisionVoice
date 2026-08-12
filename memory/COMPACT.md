# Compact Context

> **Agent**: Read this FIRST on session start. Max 30 lines.
> **Update**: Agent refreshes this every session end.

## Project

VisionVoice v2 — Expo dev client · RN · TS strict · RNFB (Gemini qua Firebase AI Logic + App Check, project `visionvoice-app-2026`) · EfficientDet-Lite0/TFLite obstacle loop · react-navigation 4 màn · half-duplex audio. App tiếng Việt cho người khiếm thị: mô tả ảnh, hỏi đáp giọng nói, cảnh báo vật cản. GRIT/ngrok đã xoá khỏi runtime và được giữ làm baseline đánh giá.

## Active Task

Không có task triển khai đang hoạt động. Bản báo cáo ưu tiên là `BaoCao_DATN_VisionVoice_60Trang.docx` với 15.505 từ, 9 bảng nội dung và 11 vị trí hình; hai bản dài hơn vẫn được giữ để đối chiếu. Báo cáo còn placeholder cho thông tin cá nhân, hình và kết quả thực nghiệm Chương 5.

## Critical Rules (top 5 lessons)

1. **Vietnamese is the user-facing language.** All UI text, TTS phrases, and voice keywords are Vietnamese; code identifiers stay English.
2. **No magic values in components.** URLs, timeouts, locales, keywords, canned phrases all live in `src/constants/config.ts` as `UPPER_SNAKE_CASE`.
3. **Accessibility is the product.** Every touchable needs `accessibilityLabel` + `accessibilityHint`; every state change gets audio (`Speech.speak`) and haptic feedback.
4. **Structure**: screens use `export default function`; services/hooks/constants use named exports. `StyleSheet.create` at file bottom, dark palette (`#07070E` bg, `#6366F1` accent). No barrel files — direct relative imports.
5. **Errors never break the flow**: `console.warn('Lỗi khi ...:', e)`, then speak a Vietnamese fallback and call `resetState()`.

## Blockers

- Chưa xác nhận trong phiên gần nhất: Gemini/App Check, ASR/TTS, camera và ML Kit trên máy Android/iOS thật.
- Worktree có thay đổi chưa commit của user: `config.ts`, `HomeCameraScreen.tsx`, `audioSession.ts`; phải bảo toàn.
- `.githooks/pre-commit` calls `memory/validate.sh`, which does not exist — hook silently no-ops.

## Last Session

2026-08-12 — Tạo `BaoCao_DATN_VisionVoice_60Trang.docx`, rút xuống 15.505 từ để dành khoảng 10–15 trang cho hình và phụ lục. Bỏ bốn mockup trùng lặp; giữ 9 bảng, 11 vị trí hình và 26 tài liệu được trích dẫn. Đoạn dài nhất 130 từ; DOCX hợp lệ, đúng lề và mở được bằng Quick Look. Không sửa source ứng dụng.
