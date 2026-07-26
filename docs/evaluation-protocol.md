# Protocol đánh giá — phục vụ Chương 5 báo cáo

4 nhóm chỉ tiêu theo thuyết minh. Mọi số đo lấy từ log VVMETRIC (Settings → Xuất nhật ký đánh giá → AirDrop/Zalo về máy tính) + phiếu chấm tay. Trước mỗi phiên đo: Settings → Xoá nhật ký, và chắc chắn `MOCK_MODE = false` (log `api_response` có `mock:true` là phiên hỏng, bỏ).

## (a) Chất lượng mô tả — so với GRIT

1. Bộ ảnh: 40 ảnh trong `eval/images/` + `eval/manifest.json`. ƯU TIÊN SỐ 1: dùng đúng bộ ảnh đã chấm GRIT ở chuyên đề (kiểm tra Google Drive chuyên đề còn không TRƯỚC TIÊN). Nếu còn reference caption thì điền vào trường `refs` của manifest.
2. Sinh caption Gemini: `GEMINI_API_KEY=... node scripts/eval-caption.mjs` → `eval/results/gemini-captions.json` (cùng model + cùng system prompt với app; nghỉ 8s/call).
3. Điểm tự động: chấm BLEU/METEOR/ROUGE-L/CIDEr bằng ĐÚNG bộ công cụ pycocoevalcap của chuyên đề (cùng implementation mới so được với bảng GRIT). Không còn tool cũ thì chỉ báo Likert và ghi chú lý do.
4. Likert: trộn caption GRIT (lưu từ chuyên đề) + Gemini trên cùng ảnh, 2 người chấm mù, thang 1–5 theo 4 tiêu chí: chính xác, đầy đủ, tự nhiên, hữu ích cho người khiếm thị. Ghi Google Sheets → xuất `eval/results/likert.csv`.
5. Lưu ý khi viết báo cáo: độ đo n-gram bất lợi cho câu dài tự do của Gemini so với caption ngắn kiểu KTVIC — điểm tự động chỉ tham khảo, Likert là chính.

## (b) Hỏi đáp

1. Bộ câu hỏi: `eval/qa-set.json` — 10 ảnh × 3 câu, 4 nhóm: hiện diện / màu sắc / đếm / vị trí không gian. Điền `expected` trước khi chạy.
2. Chạy IN-APP: mở ảnh qua thư viện (đúng ảnh của manifest) → hỏi bằng giọng nói. Log `qa_question` ghi transcript ASR thật, `qa_answer` ghi câu trả lời thật.
3. Chấm: đúng = 1 (chấp nhận từ đồng nghĩa màu sắc; đếm phải chính xác tuyệt đối), một phần = 0.5, sai = 0. ASR nghe sai câu hỏi → đánh dấu `ASR-fail`, hỏi lại 1 lần, và báo riêng tỉ lệ ASR-fail trong báo cáo (điểm hay: tách "độ chính xác mô hình" khỏi "độ chính xác đầu-cuối").

## (c) Cảnh báo vật cản

1. Hành lang 20–30 m, 5 vật cản đặt sẵn (ghế, thùng carton, người đứng, cửa hé, thùng rác). 5 lượt × 2 điều kiện sáng (đèn sáng / đèn mờ) = 10 lượt, đi chậm ~0.5 m/s, điện thoại trước ngực. Người thứ hai đếm trên giấy.
2. Định nghĩa (ghi nguyên văn vào báo cáo): cảnh báo đúng = báo khi có vật cản trong ~2 m trên lộ trình; cảnh báo sai = báo khi không có vật trên lộ trình; bỏ sót = đi qua cách vật <1 m mà không báo. Đếm theo từng mức warning/danger.
3. Từ log: fps (`obstacle_frame`), detectMs trung bình, số alert theo mức — `node scripts/parse-metrics.mjs <file>`. Ghi thêm pin trước/sau 15 phút chạy liên tục + máy có nóng không.

## (d) Thời gian phản hồi

≥30 lần chụp, chia 15 Wi-Fi / 15 4G. `parse-metrics.mjs` cho p50/p90/max của 3 giai đoạn: chụp+xử lý ảnh, Gemini, tổng đến lúc bắt đầu đọc. Số này đổ thẳng vào Bảng 5.5.

## Bảng/hình báo cáo ← nguồn số

| Bảng/Hình | Nguồn |
|---|---|
| B5.1 điểm tự động GRIT vs Gemini | pycocoevalcap + gemini-captions.json |
| B5.2 Likert | likert.csv |
| B5.3 Q&A theo nhóm | qa-set.json + phiếu chấm + log qa_* |
| B5.4 vật cản đúng/sai/sót + fps | phiếu đếm + metrics-summary.csv |
| B5.5 latency p50/p90 | metrics-summary.csv |
| H5.3 biểu đồ latency | metrics-captures.csv (vẽ bằng Sheets) |
