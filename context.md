# Session Log — 2026-08-12

## Task

Tạo báo cáo đồ án tốt nghiệp hoàn chỉnh dạng DOCX cho đề tài “Ứng dụng Image Captioning hỗ trợ người khiếm thị”, dựa trên `BaoCao_DATN_VisionVoice.html`, biểu mẫu `BieuMau.docx` và quy định trình bày trong `phuluc2_hinhthuctrinhbay (3).docx`.

## Result

- Tạo `BaoCao_DATN_VisionVoice.docx` tại thư mục gốc dự án.
- Bổ sung bìa chính, bìa phụ, thông tin hội đồng, lời cảm ơn, mục lục động, danh mục hình động, danh mục bảng động, danh mục từ viết tắt và tóm tắt đồ án.
- Giữ toàn bộ nội dung chính từ HTML gồm phần mở đầu, 6 chương, 11 bảng nội dung, 16 vị trí hình minh họa và 26 tài liệu tham khảo.
- Giữ các thông tin chưa có bằng ghi chú ngoặc vuông; không tạo số liệu thực nghiệm, tác giả hoặc kết quả mới.
- Biên tập hai chỗ dùng cụm “tuy nhiên”; không phát hiện các đại từ và cụm chuyển ý bị cấm trong bản cuối.
- Định dạng A4, Times New Roman 13 pt, dãn dòng 1,5; lề trên 3 cm, dưới 3,5 cm, trái 3,5 cm, phải 2 cm; tiêu đề chương 14 pt; không dùng in đậm, in nghiêng hoặc gạch chân.
- Số trang được cấu hình bắt đầu từ phần Tóm tắt, đặt giữa chân trang.

## Verification

- `unzip -t BaoCao_DATN_VisionVoice.docx`: gói DOCX hợp lệ, không lỗi.
- `textutil` đọc được toàn bộ tài liệu: 34.877 từ.
- OOXML: 750/750 text run có khai báo Times New Roman và cỡ chữ trực tiếp.
- 4 section có cùng lề đúng quy định; một footer và một lần bắt đầu số trang từ 1.
- Không phát hiện bullet, thuộc tính in đậm/in nghiêng/gạch chân, đại từ bị cấm hoặc sáu cụm chuyển ý bị cấm.
- Quick Look tạo được bản xem trước đầy đủ; page break giữa hai trang bìa hiển thị đúng.

## Remaining User Work

1. Điền thông tin sinh viên, mã số sinh viên, khoa, ngành, giảng viên hướng dẫn và hội đồng.
2. Chèn 16 hình minh họa tại các ghi chú đã đặt.
3. Chạy thực nghiệm và thay các ghi chú số liệu ở Chương 5.
4. Mở bằng Microsoft Word, chọn toàn bộ tài liệu rồi cập nhật field để tạo số trang cho mục lục, danh mục hình và danh mục bảng.

---

# Revision Log — 2026-08-12

## Request

Rút các phần liên quan quá nhiều đến chuyên đề, viết gọn các đoạn dài và đưa báo cáo về quy mô phù hợp khoảng 60–70 trang.

## Result

- Tạo bản rút gọn `BaoCao_DATN_VisionVoice_RutGon.docx`; giữ nguyên bản đầy đủ để đối chiếu.
- Giảm tổng dung lượng từ 34.877 xuống 21.890 từ, tương đương giảm khoảng 37%.
- Giảm phần nội dung theo chương: Mở đầu 1.278 từ; Chương 1 là 1.360; Chương 2 là 3.633; Chương 3 là 4.224; Chương 4 là 4.277; Chương 5 là 2.395; Chương 6 là 1.472 từ.
- Phần chuyên đề chỉ còn một lần nhắc trực tiếp; GRIT được giữ ở vai trò baseline, tập trung chủ yếu trong Chương 5.
- Bỏ bảng kết quả GRIT ở Chương 1, hình kiến trúc cũ và các đoạn lặp về Colab/tunnel.
- Không còn đoạn nào dài quá 150 từ.
- Chương 5 bỏ các đoạn dự đoán kết quả; phần nhận xét chung dùng placeholder chờ số liệu thật.
- Báo cáo còn 10 bảng nội dung, 15 vị trí hình và đủ 26 tài liệu tham khảo đang được trích dẫn.

## Verification

- DOCX hợp lệ qua `unzip -t`; `textutil` đọc được toàn bộ nội dung.
- Không có đại từ/cụm chuyển ý bị cấm, bullet chấm tròn, in đậm, in nghiêng hoặc gạch chân.
- 710/710 text run có khai báo phông và cỡ chữ; Times New Roman 13 pt, dãn dòng 1,5 và lề đúng quy định được giữ nguyên.
- Số trang vẫn bắt đầu từ Tóm tắt; các field mục lục và danh mục vẫn được cấu hình tự cập nhật.
- Quick Look tạo được bản xem trước đầy đủ và không phát hiện page break trùng.

---

# Revision Log — 2026-08-12 — Bản mục tiêu 60 trang

## Request

Rút thêm các phần giới thiệu và mô tả để báo cáo có thể giữ ở khoảng 60 trang sau khi chèn hình ảnh và phụ lục.

## Result

- Tạo `BaoCao_DATN_VisionVoice_60Trang.docx`; giữ nguyên hai bản trước để đối chiếu.
- Giảm nội dung xuống 15.505 từ: Mở đầu 993 từ; Chương 1 là 1.073; Chương 2 là 2.234; Chương 3 là 2.941; Chương 4 là 3.289; Chương 5 là 2.429; Chương 6 là 1.300 từ.
- Bỏ bảng so sánh Image Captioning chuyên biệt với MLLM và bốn hình mockup ở Chương 3; giữ các sơ đồ luồng, ảnh màn hình thật, bảng cấu hình và protocol thực nghiệm.
- Nội dung chuyên đề chỉ còn một lần nhắc; GRIT chỉ giữ vai trò baseline. Không còn nội dung Colab hoặc tunnel.
- Báo cáo còn 9 bảng nội dung, 11 vị trí hình và đủ 26 tài liệu tham khảo đang được trích dẫn.
- Đoạn dài nhất là 130 từ; các đoạn giới thiệu được gom ngắn, phần kỹ thuật và đánh giá được giữ nhiều dung lượng hơn.

## Verification

- `unzip -t` xác nhận gói DOCX hợp lệ; `textutil` đọc được toàn bộ tài liệu.
- Không có đại từ hoặc sáu cụm chuyển ý bị cấm, bullet chấm tròn, in đậm, in nghiêng hoặc gạch chân trực tiếp.
- Khổ A4 và lề trên 3 cm, dưới 3,5 cm, trái 3,5 cm, phải 2 cm được giữ ở cả 4 section.
- Toàn bộ 26 tài liệu tham khảo đều có trích dẫn; 91 vị trí cần điền số liệu hoặc thông tin vẫn được giữ bằng ngoặc vuông.
- Quick Look tạo được thumbnail và preview nhiều trang; trang bìa hiển thị đúng.

## Remaining User Work

1. Điền thông tin sinh viên, khoa, ngành, giảng viên hướng dẫn và hội đồng.
2. Chèn 11 hình tại các caption đã đặt và bổ sung phụ lục cần thiết.
3. Chạy protocol Chương 5 và thay các ghi chú kết quả bằng số liệu thật.
4. Mở file bằng Microsoft Word, cập nhật mục lục, danh mục hình, danh mục bảng và kiểm tra số trang cuối sau khi chèn hình.
