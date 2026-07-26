# Checklist trước demo (~45 phút, chạy trên CẢ 2 máy demo)

## Khởi động & quyền
- [ ] Xoá app, cài mới → lời chào tiếng Việt đọc rõ, KHÔNG có câu "chế độ thử nghiệm" (`MOCK_MODE = false`).
- [ ] Từ chối quyền camera → app đọc thông báo tiếng Việt, không crash; cấp lại trong Settings hệ thống → hoạt động.
- [ ] Từ chối quyền micro → vẫn chụp được bằng nút/phím âm lượng, app đọc cảnh báo mất điều khiển giọng nói.
- [ ] Giọng vi-VN chuẩn (không giọng Anh). Sai → cài Google TTS + dữ liệu tiếng Việt (xem `docs/app-check-setup.md` không liên quan — đây là TTS engine của máy).
- [ ] App Check: chụp 1 ảnh có caption về (debug token còn sống — xem `docs/app-check-setup.md`).

## Mô tả ảnh
- [ ] Nói "chụp ảnh" → shutter + rung mạnh → "Đã chụp. Đang phân tích..." → mô tả được đọc; tổng < ~8s trên 4G.
- [ ] Phím âm lượng chụp được; nút màn hình chụp được; kết quả GIỮ trên màn (không tự biến mất).
- [ ] Chọn ảnh thư viện → mô tả đúng ảnh đã chọn.
- [ ] Đang đọc mô tả, nói "chụp ảnh" → KHÔNG tự kích hoạt (half-duplex).
- [ ] "Đọc lại" → đọc lại đúng mô tả cũ.
- [ ] Bật chế độ máy bay → chụp → đọc câu lỗi mạng tiếng Việt (không im lặng, không đọc lỗi như caption) → về trạng thái sẵn sàng.

## Hỏi đáp
- [ ] "Hỏi" sau khi có ảnh → sang màn hỏi đáp, có câu mời hỏi.
- [ ] Hỏi "trong ảnh có gì màu đỏ?" → trả lời liên quan đúng ảnh.
- [ ] Hỏi tiếp câu 2 → vẫn cùng ngữ cảnh ảnh đó (thử "nó màu gì?").
- [ ] Giữ phím âm lượng khi máy đang đọc → ngắt lời + mở mic (barge-in).
- [ ] "Quay lại" → về máy ảnh, đọc câu xác nhận.
- [ ] Máy bay mode khi hỏi → câu lỗi mạng, quay lại chờ nghe.

## Cảnh báo vật cản
- [ ] "Vật cản" / nút góc → màn cảnh báo, đọc hướng dẫn cầm máy.
- [ ] KHÔNG có tiếng màn trập lặp mỗi giây (kiểm tra kỹ trên máy demo).
- [ ] Tiến về ghế → warning (nền vàng + rung) rồi danger (nền đỏ + beep + rung kép) trong ~2–3s.
- [ ] Đứng yên nhìn tường trống 60s → tối đa 1 cảnh báo sai.
- [ ] Cảnh báo cách nhau ≥2s, không spam.
- [ ] Chạy 10 phút liên tục → máy không quá nóng, fps không sập (xem VVMETRIC).
- [ ] "Dừng lại" → về máy ảnh, KHÔNG còn cảnh báo rơi rớt sau khi thoát.
- [ ] Background rồi quay lại → camera không đen/treo.

## Cài đặt
- [ ] Tăng tốc độ đọc → nghe câu mẫu tốc độ mới; kill app mở lại → còn nhớ.
- [ ] "Nghe thử giọng đọc" chạy.
- [ ] "Xuất nhật ký đánh giá" → share sheet mở, JSON gửi được.
- [ ] "Xoá nhật ký" → có xác nhận giọng nói.

## TalkBack / VoiceOver (10 phút mỗi máy)
- [ ] Bật screen reader → quét mọi nút: đều có nhãn tiếng Việt, không "unlabeled button".
- [ ] App TTS không đọc chồng screen reader đến mức không hiểu (app tự chuyển qua announceForAccessibility).
- [ ] Chụp + hỏi + bật cảnh báo làm được hoàn toàn qua screen reader.
- [ ] Tắt screen reader → app đọc TTS bình thường trở lại.
