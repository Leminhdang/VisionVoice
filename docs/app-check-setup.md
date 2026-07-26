# App Check — thiết lập cho dev và demo

Firebase AI Logic bật cưỡng chế App Check: thiếu token hợp lệ là mọi lời gọi Gemini trả 403.
Project: `visionvoice-app-2026` · 2 app `com.visionvoice.app` (Android + iOS).

## Vòng dev (debug provider — mặc định khi `__DEV__`)

1. Build và chạy app trên máy (`yarn android` / `yarn ios`).
2. Lần chạy đầu, debug provider in token ra native log:
   - Android: `adb logcat | grep -i "appcheck"` (dòng chứa `DebugAppCheckProvider` kèm UUID).
   - iOS: Xcode console, tìm `Firebase App Check debug token`.
3. Firebase console → App Check → Apps → chọn app → menu ⋮ → **Manage debug tokens** → Add → dán token, đặt tên theo máy.
4. Mỗi máy/emulator 1 token riêng. Xoá app cài lại là token đổi — đăng ký lại.
5. Kiểm tra: mở app, chụp 1 ảnh — có caption là token sống; 403 trong log = quay lại bước 2.

## Bản demo/release

- Android: cần SHA-256 của **keystore ký bản build đó** trong Firebase console → Project settings → app Android. SHA debug keystore đã được thêm sẵn (qua MCP). Nếu ký release keystore khác thì thêm SHA-256 của nó rồi tải lại `google-services.json`.
- iOS: App Attest cần máy thật + đúng team ID; DeviceCheck là fallback tự động. Thử bản demo trên đúng máy demo VÀI NGÀY trước bảo vệ.
- Đường lui: console → App Check → AI Logic → chuyển **Unenforced** (monitor) trong kỳ đánh giá, bật lại trước demo.

## Lấy lại file cấu hình (đã gitignore)

`google-services.json` + `GoogleService-Info.plist` nằm ở repo root, không commit.
Mất thì lấy lại bằng Firebase MCP (`firebase_get_sdk_config` platform android/ios, project `visionvoice-app-2026`) hoặc console → Project settings → tải file.
