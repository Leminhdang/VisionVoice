# Project Context

> This file reflects current project state. AI agents MUST update this when starting/completing tasks. Can be overwritten (not append-only). **Max 100 lines** — keep it compact.

## Current Focus

(no active implementation task)

## Current State

- Branch `feature/rebuild-v2`, HEAD `49f15e6`.
- VisionVoice v2 là app Expo SDK 54/RN 0.81.5/TypeScript strict, dev client, 4 màn hình.
- Ba tính năng chính đã có source: mô tả ảnh qua Gemini/Firebase AI Logic, Q&A nhiều lượt theo ảnh, cảnh báo vật cản on-device bằng ML Kit.
- Half-duplex audio được tập trung tại `services/audioSession.ts`; screen/component không gọi `Speech.speak` trực tiếp.
- Toàn bộ chuỗi người dùng ở `constants/strings.ts`; tunable ở `constants/config.ts`; settings persist bằng AsyncStorage.
- Metrics in-memory + `VVMETRIC` console hỗ trợ scripts đánh giá caption, Q&A, latency và obstacle FPS.

## Main Execution Flows

1. Home capture/gallery → resize/compress/base64 → Gemini describe → TTS → giữ ảnh/caption để đọc lại hoặc mở Q&A.
2. Q&A → tạo chat session → gửi ảnh ở lượt đầu → ASR câu hỏi → Gemini answer → TTS → tự nghe lại; hỗ trợ barge-in bằng phím âm lượng.
3. Obstacle → self-scheduling still-frame loop → ML Kit detect → bbox area + center-band heuristic → cooldown policy → màu/rung/earcon/TTS; file frame được xoá trong `finally`.
4. Startup → TTS + Firebase App Check + SettingsProvider + ML Kit provider + navigation; permission bootstrap nói hướng dẫn trước khi mở dialog hệ thống.

## Verification (2026-08-04)

- `yarn typecheck`: pass.
- `yarn test --runInBand --no-cache --watchman=false`: 3 suites, 39 tests pass.
- `git diff --check`: pass.
- Không chạy build/device test trong session này.

## Worktree Safety

- User có thay đổi chưa commit trong `src/constants/config.ts`, `src/screens/HomeCameraScreen.tsx`, `src/services/audioSession.ts`; phải bảo toàn.
- `.agent/`, `.githooks/`, `memory/` đang untracked theo `git status`.

## Outstanding Validation

1. App Check/debug token và Gemini thật trên project `visionvoice-app-2026`.
2. Camera, ASR/TTS half-duplex, phím âm lượng và ML Kit loop trên Android/iOS thật.
3. Nhiệt, tiếng màn trập, FPS và cleanup khi chạy obstacle mode lâu.
4. Dữ liệu `eval/manifest.json`/`eval/qa-set.json` hiện còn placeholder, chưa sẵn sàng cho đánh giá chính thức.
5. `.githooks/pre-commit` tham chiếu `memory/validate.sh` không tồn tại.

## Session Log (last 5 sessions)

### 2026-08-04 — Codebase comprehension
- Đọc toàn bộ source TS/TSX, unit tests, manifests, docs, scripts, memory và plan rebuild v2.
- GitNexus chưa index VisionVoice nên dùng source/import graph trực tiếp, không tạo index để tránh mutation ngoài scope.
- Xác nhận typecheck và unit tests pass; không sửa source.

### 2026-07-26 — Rebuild v2 planning/foundation
- Chốt Firebase AI Logic, ML Kit still-image loop, half-duplex audio, dev client và kiến trúc 4 màn hình.
