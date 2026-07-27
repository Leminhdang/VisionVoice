# VisionVoice

> Ứng dụng hỗ trợ người khiếm thị bằng giọng nói — mô tả ảnh, hỏi đáp và cảnh báo vật cản.

VisionVoice là ứng dụng di động tiếng Việt dành cho người mù và nhược thị, sử dụng AI để mô tả khung cảnh qua camera và cảnh báo vật cản theo thời gian thực. Đây là bản rebuild v2 cho đồ án tốt nghiệp.

## Tính năng

### 📸 Mô tả ảnh
Chụp ảnh bằng giọng nói ("chụp ảnh"), nút volume, nút chụp trên màn hình hoặc chọn từ thư viện → ảnh được resize và gửi lên Gemini qua Firebase AI Logic → mô tả được đọc lại bằng TTS.

### 💬 Hỏi đáp giọng nói
Sau khi có mô tả, người dùng có thể hỏi thêm về ảnh (VD: "trong ảnh có mấy người?", "cái áo màu gì?"). Phiên chat nhiều lượt — ảnh chỉ gửi lần đầu. Nói "quay lại" hoặc "dừng" để thoát.

### ⚠️ Cảnh báo vật cản
Vòng lặp chụp ảnh nhanh (~0.9s) → ML Kit Object Detection on-device → đánh giá mức độ (an toàn / cảnh báo / nguy hiểm) → thông báo bằng giọng nói + rung + màu toàn màn hình.

### 🎤 Điều khiển hoàn toàn bằng giọng nói
Mọi thao tác đều có thể thực hiện bằng giọng nói: chụp ảnh, mở thư viện, hỏi đáp, chuyển màn hình, cài đặt. Audio half-duplex đảm bảo app không bao giờ nghe tiếng chính mình.

---

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Expo SDK ~54 (dev client) |
| Runtime | React Native 0.81.5 · React 19.1.0 |
| Language | TypeScript 5.9 strict |
| AI | Firebase AI Logic (`gemini-3.6-flash`) qua `@react-native-firebase/{app,ai,app-check}` 23.8.8 |
| Object Detection | Google ML Kit on-device (`@infinitered/react-native-mlkit-object-detection` 5.0.0) |
| Camera | expo-camera |
| TTS | expo-speech (vi-VN) |
| ASR | expo-speech-recognition |
| Navigation | @react-navigation/native-stack (4 screens) |

> **Lưu ý:** Expo Go **không** dùng được vì project sử dụng native modules. Cần build dev client.

---

## Yêu cầu hệ thống

- **Node.js** ≥ 18
- **Yarn** (v1 classic)
- **Xcode** ≥ 15 (cho iOS, cần macOS)
- **Android Studio** + Android SDK (cho Android)
- **Máy thật** (khuyến nghị) — ML Kit và speech recognition hoạt động tốt nhất trên thiết bị thật
- **Firebase project** `visionvoice-app-2026` đã được cấu hình sẵn (SDK config files có trong repo)

---

## Cài đặt & Chạy

### 1. Clone và cài dependencies

```bash
git clone <repo-url>
cd VisionVoice
yarn install
```

### 2. Prebuild native projects

```bash
npx expo prebuild --clean
```

Lệnh này tự động:
- Tạo thư mục `ios/` và `android/`
- Áp dụng plugin `withMLKitVersionFix` để resolve conflict ML Kit / Firebase
- Cài CocoaPods cho iOS

### 3. Chạy trên thiết bị

```bash
# Android
yarn android

# iOS
yarn ios
```

### 4. Đăng ký App Check debug token

Lần chạy đầu tiên, app sẽ in debug token ra native log:

- **Android:** `adb logcat | grep -i "appcheck"` — tìm dòng `DebugAppCheckProvider` chứa UUID
- **iOS:** Xcode console — tìm `Firebase App Check debug token`

Đăng ký token trong Firebase console:
1. Vào [Firebase Console](https://console.firebase.google.com) → project `visionvoice-app-2026`
2. App Check → Apps → chọn app → ⋮ → **Manage debug tokens**
3. Add → dán token → đặt tên theo máy

> ⚠️ Mỗi máy/emulator có token riêng. Xóa app cài lại sẽ đổi token — cần đăng ký lại.

### 5. Kiểm tra

Mở app → chụp 1 ảnh → nếu có mô tả bằng giọng nói = **thành công** ✅

Nếu gặp lỗi 403 trong log = token chưa đăng ký, quay lại bước 4.

---

## Các lệnh hữu ích

```bash
yarn install                    # Cài dependencies
yarn typecheck                  # Kiểm tra TypeScript (tsc --noEmit)
yarn test                       # Chạy unit tests (jest)
npx expo prebuild --clean       # Tạo lại android/ + ios/
yarn android                    # Build + chạy Android dev client
yarn ios                        # Build + chạy iOS dev client
```

---

## Cấu trúc project

```
VisionVoice/
├── index.ts                     # Entry point
├── App.tsx                      # Root: Firebase init, TTS init, providers, navigation
├── src/
│   ├── constants/
│   │   ├── config.ts            # Tham số cấu hình (model, thresholds, timings, MOCK_MODE)
│   │   └── strings.ts           # Tất cả chuỗi tiếng Việt + system instruction
│   ├── theme/                   # Design tokens (colors, typography, spacing)
│   ├── navigation/              # Stack navigator (4 screens)
│   ├── screens/
│   │   ├── HomeCameraScreen     # Camera + chụp ảnh + hiển thị kết quả
│   │   ├── QASessionScreen      # Hỏi đáp nhiều lượt về ảnh
│   │   ├── ObstacleModeScreen   # Cảnh báo vật cản real-time
│   │   └── SettingsScreen       # Cài đặt giọng nói + xuất metrics
│   ├── services/                # Business logic (gemini, audioSession, tts, obstacleDetector...)
│   ├── hooks/                   # React hooks (useVoiceControl, useQASession, useObstacleScanner...)
│   ├── components/              # UI components (ShutterButton, StateIndicator, SeverityBanner...)
│   └── state/                   # State management (captureMachine, SettingsContext)
├── plugins/
│   └── withMLKitVersionFix.js   # Expo config plugin: fix ML Kit / Firebase pod conflict
├── assets/sounds/               # Earcons (shutter, listen-start, listen-end, danger)
├── eval/                        # Dữ liệu + scripts đánh giá cho báo cáo
├── scripts/                     # Scripts hỗ trợ (eval-caption, parse-metrics)
└── docs/                        # Tài liệu kỹ thuật + hướng dẫn
```

---

## MOCK_MODE

Để phát triển UI mà không tốn quota Gemini (free tier), bật `MOCK_MODE = true` trong `src/constants/config.ts`. App sẽ trả về mô tả giả sau 1–2 giây delay thay vì gọi API thật.

---

## Đánh giá (Evaluation)

Project bao gồm bộ đánh giá cho báo cáo đồ án:

- `eval/manifest.json` — danh sách ảnh test
- `eval/qa-set.json` — bộ câu hỏi đánh giá
- `scripts/eval-caption.mjs` — so sánh chất lượng mô tả
- `scripts/parse-metrics.mjs` — phân tích metrics từ log

Chi tiết protocol đánh giá: xem `docs/evaluation-protocol.md`.

---

## Lưu ý quan trọng

- **Version pins cố ý:** `@react-native-firebase` 23.8.8 (v25 cần Xcode mới hơn), `jest` ~29.7 (tương thích jest-expo). Không nâng version nếu chưa verify build.
- **iOS deployment target:** 16.0 (yêu cầu bởi GoogleMLKit 9.0).
- **Thêm native module mới** = cần `npx expo prebuild --clean` + rebuild, không chỉ Metro reload.
- **App Check:** Nếu gặp vấn đề khi demo, có thể tạm chuyển sang **Unenforced** trong Firebase console → App Check → AI Logic.

---

## License

Đồ án tốt nghiệp — chỉ dùng cho mục đích học thuật.
