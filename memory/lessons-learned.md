# Lessons Learned

> Append-only. Never delete entries. Mark outdated entries `[ARCHIVED]`.
> All entries MUST include Tags for searchability. Max 30 active entries.

## Active Lessons

<!-- Add new lessons here. Format:
### [YYYY-MM-DD] Short descriptive title
- **Tags**: keyword1, keyword2, keyword3
- **Confidence**: LOW | MEDIUM | HIGH
- **Domain**: code-style | testing | performance | architecture | workflow | android | ios | state-management | socket | notification
- **What went wrong**: concrete description
- **Root cause**: why it happened (not symptoms)
- **Rule**: actionable rule to prevent recurrence
- **Last confirmed**: YYYY-MM-DD
-->

### [2026-08-12] Dành ngân sách trang cho hình và phụ lục trước khi rút báo cáo
- **Tags**: report, page-budget, figures, appendix, docx
- **Confidence**: HIGH
- **Domain**: workflow
- **What went wrong**: Bản rút gọn đầu tiên vẫn quá dài khi mục tiêu số trang phải bao gồm hình ảnh và phụ lục sẽ chèn sau.
- **Root cause**: Dung lượng được ước tính chủ yếu theo phần văn bản, chưa tách trước số trang cần dành cho hình và phụ lục.
- **Rule**: Khi người dùng đặt giới hạn trang cho báo cáo, phải xác định ngân sách riêng cho phần văn bản, hình và phụ lục; tạo bản mới thay vì ghi đè để có thể đối chiếu.
- **Last confirmed**: 2026-08-12

### [2026-08-17] jest-expo 56 cần peer dep riêng nhưng vẫn chạy trên jest 29
- **Tags**: jest, jest-expo, testing, expo-56, peer-dependency
- **Confidence**: HIGH
- **Domain**: testing
- **What went wrong**: `yarn test` fail vì thiếu `@react-native/jest-preset`. Khi sửa, đã nâng luôn jest 29→30, khiến toàn bộ 3 suite fail với `this._moduleMocker.clearMocksOnScope is not a function`.
- **Root cause**: jest-expo 56 khai báo peer `@react-native/jest-preset ^0.85.0` (preset RN tách ra khỏi core từ RN 0.85) NHƯNG dependencies nội bộ của nó vẫn là `^29.2.1` (`@jest/globals`, `jest-environment-jsdom`, `jest-snapshot`). Chạy runner 30 trên các module 29 làm vỡ API nội bộ của jest-runtime.
- **Rule**: Với Expo SDK 56, chỉ thêm `@react-native/jest-preset@^0.85.0` và GIỮ NGUYÊN `jest@~29.7` + `@types/jest@^29` — đúng như pin đã ghi trong CLAUDE.md. Khi peer dep báo thiếu, kiểm tra `dependencies` của package đó trước khi nâng major.
- **Last confirmed**: 2026-08-17

### [2026-08-17] startListening() xoá cờ isSpeaking làm app nghe chính giọng mình
- **Tags**: audio, half-duplex, asr, tts, voice-command, race-condition
- **Confidence**: HIGH
- **Domain**: architecture
- **What went wrong**: Lệnh giọng nói "chụp ảnh" và lệnh chuyển chế độ không dùng được: app tự chụp ảnh khi vừa mở, hoặc vừa vào chế độ dò vật cản đã tự thoát ra.
- **Root cause**: `audioSession.startListening()` đặt `isSpeaking = false` rồi gọi `startRecognition()`, mà `startRecognition()` lại không kiểm tra `isSpeaking`. Màn hình luôn gọi startListening() trong lúc `speakExclusive(NAV.*)` đang đọc lời giới thiệu, nên mic mở giữa câu. Các câu NAV.* lại đọc to đúng từ khoá lệnh ("Nói 'chụp ảnh'…", "Nói 'dừng lại'…") nên ASR nghe chính giọng app rồi kích hoạt intent. Lỗi lúc được lúc không vì startListening là async (chờ xin quyền) nên thứ tự phụ thuộc thời điểm hộp thoại quyền resolve.
- **Rule**: Chỉ `speakExclusive()` được phép hạ cờ `isSpeaking`, và phải hạ VÔ ĐIỀU KIỆN khi lượt đọc của nó kết thúc. Mọi hàm mở mic phải kiểm tra `isSpeaking` trong guard. Khi thêm nhánh vào audioSession, viết test hồi quy với `tts.speak` bị treo (deferred promise) — bất biến half-duplex không kiểm được bằng mắt.
- **Sai lầm khi sửa (cùng ngày)**: Bản sửa đầu chỉ xoá `isSpeaking = false` khỏi `startListening()` mà không nhận ra dòng đó là VAN THOÁT duy nhất của cờ. Cờ chỉ được hạ bên trong timer restart, mà `stopListening()` lại huỷ đúng timer đó → blur trong cửa sổ guard 400ms làm cờ kẹt true vĩnh viễn → mic không bao giờ mở lại trên mọi màn. Nặng hơn lỗi gốc.
- **Rule bổ sung**: Một cờ vừa chặn hành động vừa được xoá bởi timer là mẫu thiết kế sai — mọi hàm có quyền huỷ timer đó sẽ làm kẹt cờ. Tách ra: cờ trạng thái thật (`isSpeaking`, hạ vô điều kiện) và mốc thời gian hết hạn (`guardUntilMs`, tự hết hạn, không kẹt được).
- **Last confirmed**: 2026-08-17

---

## Archived Lessons

<!-- Move outdated/superseded lessons here. Agents skip this section. -->
