# Handoff

**Status**: INACTIVE
**From**: Codex (session 2026-08-04)
**To**: bất kỳ agent tiếp theo
**Date**: 2026-08-04
**Task**: Không có task triển khai đang bàn giao
**Plan file**: `~/.claude/plans/1-m-c-ti-u-nghi-n-happy-acorn.md` (lịch sử rebuild v2)

---

## Current State

- Branch `feature/rebuild-v2`, HEAD `49f15e6`: source v2, 4 màn hình, core services/hooks, 3 unit-test suite, docs và scripts đánh giá đã được triển khai.
- `yarn typecheck` sạch; 39/39 unit test pass ngày 2026-08-04 với `yarn test --runInBand --no-cache --watchman=false`.
- Worktree có thay đổi chưa commit của user trong `src/constants/config.ts`, `src/screens/HomeCameraScreen.tsx`, `src/services/audioSession.ts`; không ghi đè.

## Next Steps

1. Chờ user giao task mới.
2. Khi chuẩn bị demo: xác nhận App Check/debug token, Gemini thật, camera/ASR/TTS và ML Kit trên cả Android/iOS theo `docs/pre-demo-checklist.md`.
3. Hoàn thiện dữ liệu placeholder trong `eval/manifest.json`, `eval/qa-set.json` trước khi chạy protocol đánh giá.

## Open Questions

- Trạng thái kiểm thử máy thật/App Check hiện tại chưa được xác nhận trong session 2026-08-04.
