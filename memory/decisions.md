# Architecture Decisions

> Append-only. Never delete entries. Format below.

<!-- Add new decisions here. Format:
### [YYYY-MM-DD] Decision title
- **Tags**: keyword1, keyword2, keyword3
- **Context**: what problem we were solving
- **Decision**: what we chose
- **Alternatives**: what we rejected and why
- **Consequences**: what this means going forward
-->

### [2026-07-26] Rebuild v2: Gemini qua Firebase AI Logic, ML Kit loop, bỏ GRIT
- **Tags**: gemini, firebase-ai-logic, app-check, mlkit, obstacle, sdk54, rebuild
- **Context**: Đồ án tốt nghiệp mở rộng: mô tả ảnh + Q&A qua Gemini, cảnh báo vật cản on-device. GRIT/ngrok cũ chỉ còn là mốc so sánh offline.
- **Decision**: (1) `@react-native-firebase/{app,ai,app-check}@23.8.8` pin cho SDK 54 (v25 đòi Xcode 26.2); GoogleAIBackend/Spark, model `gemini-3.6-flash` fallback `gemini-3.1-flash-lite`. (2) Vật cản = `@infinitered/react-native-mlkit-object-detection@5.0.0` + vòng lặp `takePictureAsync` ~1s (khớp thuyết minh ML Kit, cảnh báo 2–3s). (3) Giữ SDK 54, dev client, cả Android+iOS. (4) Half-duplex audio (ASR dừng khi TTS nói). (5) Firebase project `visionvoice-app-2026` tạo qua MCP.
- **Alternatives**: Branch `feature/obstacle` (TFLite + vision-camera v4 + patch reanimated 4331 dòng, tắt newArch) — bỏ vì sai công nghệ so thuyết minh + khó bảo trì; chỉ giữ ngưỡng bbox 0.18/0.35 làm tham khảo. VisionCamera v5 trên RN 0.81 — chưa được maintainer test. Không có plugin ML Kit object detection nào cho vision-camera còn sống 2026.
- **Consequences**: Expo Go chết — bắt buộc `expo prebuild` + dev client. App Check auto-enforced: dev cần debug token đăng ký per-device. Bỏ deps: axios, expo-av (→expo-audio), expo-screen-capture. Plan chi tiết: ~/.claude/plans/1-m-c-ti-u-nghi-n-happy-acorn.md
