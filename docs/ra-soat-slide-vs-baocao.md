# Rà soát slide bảo vệ đối chiếu với báo cáo và mã nguồn

**Ngày rà soát:** 2026-09-06
**Đầu vào:** `VisionVoice_BaoCao_DATN.pdf` (17 slide) · `BaoCao_DATN_VisionVoice_v2.docx.pdf` (53 trang) · mã nguồn nhánh `feature/obstacle` (`070d6a0`)

Ba nhóm vấn đề, xếp theo mức nguy hiểm khi bảo vệ.

---

## A. Sai về kỹ thuật — sửa gấp

Các con số dưới đây đã được đối chiếu trực tiếp với mã nguồn, không lấy từ trí nhớ.

### A1. Slide 5 mô tả pipeline vật cản theo cách làm CŨ ĐÃ HỎNG

> Slide 5: *"Pixel buffer BGRA → RGB 320×320 → Fast-TFLite"*

Đây chính là bug lớn nhất nhóm đã sửa. `src/services/imagePreprocess.ts` ghi rõ ở đầu file:

> *"Không dùng `Photo.getPixelBuffer()`: trên Android nó trả dữ liệu ĐÃ NÉN (JPEG), không phải raw pixels."*

Báo cáo trang 37 và 41 đã kể đúng câu chuyện này. **Chỉ slide còn giữ mô tả sai.**

**Sửa thành:** "Ảnh chụp → đối tượng `Image` của hệ thống (áp EXIF orientation) → thu nhỏ 320×320 native → đọc điểm ảnh theo `pixelFormat` thật → Fast-TFLite"

### A2. Tốc độ khung hình mâu thuẫn

| Nguồn | Con số |
|---|---|
| Slide 8 | "~900ms (**1–2 FPS**)" |
| Báo cáo tr.24, 38, 48 | "khoảng **0,7 khung hình mỗi giây**", "tổng cộng khoảng 1,5 giây" |

Báo cáo đúng: 900ms chờ + ~600ms xử lý ≈ 1,5s mỗi khung.

**Sửa slide 8:** 1–2 FPS → **~0,7 FPS**

### A3. Báo cáo tự mâu thuẫn về thời gian đệm half-duplex

| Vị trí | Con số |
|---|---|
| Báo cáo tr.23 (mục 3.3.1) | "mở lại micro sau khoảng đệm **40ms**" |
| Báo cáo tr.34 (mục 4.4.1) | "chờ thêm **400 ms**" |
| Slide 9 | 400ms |
| Code `TTS_GUARD_DELAY_MS` | **400** |

**Sửa báo cáo tr.23:** 40ms → 400ms

### A4. Báo cáo liệt kê sai các trạng thái của máy trạng thái chụp

> Báo cáo tr.24: *"các trạng thái idle, capturing, **processing, describing**, speaking và error"*

Code `src/state/captureMachine.ts`:

```ts
export type AppPhase = 'idle' | 'capturing' | 'analyzing' | 'speaking';
```

**4 trạng thái**, không có `processing`, `describing` hay `error` riêng (sự kiện `ERROR` đưa thẳng về `idle`). Chính Bảng 3.1 ngay bên dưới cũng dùng `analyzing`.

**Sửa báo cáo:** đoạn văn phải khớp với Bảng 3.1 và với code.

### A5. Số câu trong system instruction sai ở cả slide lẫn báo cáo

Slide 6 và báo cáo tr.15 / tr.32 đều ghi *"2–4 câu ngắn"*.

Code `src/constants/strings.ts`:

> *"Mỗi câu trả lời gồm **2 đến 3 câu ngắn, tổng độ dài tối đa 150 ký tự**."*

**Sửa cả hai.** Nên bổ sung luôn chi tiết "tối đa 150 ký tự" — nó thể hiện có cân nhắc độ dài khi đọc bằng TTS.

### A6. Sai tên hằng số

Slide 6 ghi `MOCK_MODEL`. Code và báo cáo đều là **`MOCK_MODE`**.

### A7. "80 nhãn COCO" — đúng về model, sai về bảng ánh xạ

Model nhận diện 80 lớp, nhưng bảng nhãn trong code là `COCO_90_LABELS` — **90 phần tử, trong đó 10 ô ghost** (`null`).

Rút bảng xuống 80 phần tử liền mạch chính là bug từng khiến `chair` bị đọc thành `toilet`. Đây là chi tiết đáng đưa vào slide "Khó khăn & cách giải quyết" thay vì giấu đi.

---

## B. Lỗi trình bày

### B1. Tên riêng bị tách sai

Do phần mềm tự tách camelCase, xuất hiện khắp slide:

| Sai | Đúng |
|---|---|
| `Efficient Det-Lite0` | `EfficientDet-Lite0` |
| `speak Exclusive` | `speakExclusive` |
| `ios Category` | `iosCategory` |
| `announce For Accessibility` | `announceForAccessibility` |
| `Vision Camera` | `VisionCamera` |

### B2. Chính tả

- Slide 3: *"hoàn bộ bằng tiếng Việt"* → **hoàn toàn**
- Slide 16: *"Bổ dung tùy chọn"* → **Bổ sung**

### B3. Kết luận khi chưa có số liệu

Lỗi phương pháp, hội đồng rất hay bắt:

- Slide 13: *"thiếu sáng làm giảm score TFLite → tăng tỷ lệ bỏ sót"*
- Slide 13: *"vòng lặp ~900ms đáp ứng tốt chu kỳ đi bộ chậm"*
- Slide 14: *"Thu nhỏ ảnh về 800px giảm mạnh thời gian upload"*

Bảng ngay bên trên toàn *(điền sau thực nghiệm)* mà phần nhận xét đã kết luận.

**Sửa:** đổi thành **giả thuyết cần kiểm chứng**, hoặc bỏ tới khi có số liệu thật.

### B4. Claim quá mạnh

Slide 15: *"Bảo mật tối đa"* → *"Không nhúng khóa Gemini trong ứng dụng; request được xác thực bằng App Check"*

---

## C. Thiếu gì so với báo cáo — các trang cần thêm

Slide hiện bỏ trắng **toàn bộ Chương 1 (trừ mục kế thừa), toàn bộ Chương 2, và các mục 3.1, 3.3, 3.5, 4.7**.

### Bắt buộc thêm (4 trang)

#### ① Sơ đồ kiến trúc — nâng cấp slide 5

Slide 5 hiện chỉ là hai cột bullet chữ. Báo cáo có Hình 3.1–3.4 dành sẵn cho sơ đồ. Một slide bảo vệ về kiến trúc hệ thống mà không có sơ đồ khối là điểm yếu lớn nhất về mặt trình bày.

Nội dung sơ đồ: người dùng → giao diện → hai nhánh
- **Cloud:** App Check → Firebase AI Logic → Gemini
- **On-device:** VisionCamera → Image → TFLite → heuristic

cùng lớp âm thanh half-duplex dùng chung.

#### ② Ảnh chụp màn hình thật — nâng cấp slide 10

Báo cáo **đã có sẵn ảnh thật**: Hình 4.1 (HomeCamera), Hình 4.3 (ba mức vật cản), Hình 4.4 (Settings). Slide 10 lại chỉ mô tả bằng chữ.

Hình 4.3 đặc biệt tốt — ba màn hình AN TOÀN / VẬT CẢN / NGUY HIỂM cạnh nhau thể hiện ngay được thiết kế tương phản.

> **Thiếu Hình 4.2 (QASession)** ở cả báo cáo lẫn slide — cần chụp bổ sung.

#### ③ Khó khăn & cách giải quyết (mục 4.7) — slide mới

Slide ghi điểm mạnh nhất, đang thiếu hoàn toàn. Báo cáo đã có sẵn 6 câu chuyện kỹ thuật thật:

1. ML Kit nhãn quá khái quát + không tương thích RN → chuyển sang EfficientDet-Lite0
2. Model đầu tiên thiếu bước post-process → đầu ra chỉ là độ lệch anchor, không detect được gì
3. `getPixelBuffer()` trả dữ liệu nén chứ không phải pixel thô
4. App Check trả 403 do chưa đăng ký debug token trên thiết bị mới
5. iOS: ASR đổi audio session làm TTS nhỏ tiếng → `iosCategory: default`
6. Timeout khai báo trong config nhưng chưa áp vào lời gọi → app treo ở trạng thái "đang xử lý"

Có thể bổ sung thêm bug bảng nhãn 90 vs 80 ở mục A7.

#### ④ Phương pháp thu số liệu (mục 3.5 + 5.1) — slide mới

Đặt **trước** các slide bảng kết quả. Slide 11–14 hiện nhảy thẳng vào bảng mà chưa nói số liệu ở đâu ra.

Nội dung: 7 loại event `VVMETRIC` · xuất JSON qua màn Settings · `scripts/parse-metrics.mjs` tính p50/p90 · `scripts/eval-caption.mjs` chấm caption offline · quy tắc loại dữ liệu `MOCK_MODE` khỏi kết quả.

### Nên thêm (2 trang)

#### ⑤ Các ứng dụng hiện có & khoảng trống tiếng Việt (mục 1.2)

Google Lookout, Be My Eyes, Microsoft Seeing AI. Hội đồng gần như chắc chắn hỏi *"khác gì Seeing AI?"*. Không có slide này thì phải trả lời vo.

#### ⑥ Cơ sở lý thuyết rút gọn (mục 2.1)

Encoder-Decoder → Transformer/ViT → MLLM, và KTVIC/UIT-ViIC. Đồ án tốt nghiệp CNTT mà slide không có phần nền tảng lý thuyết là thiếu sót về hình thức.

### Slide dự phòng — để sau slide cảm ơn, chỉ mở khi bị hỏi

- Bảng 3.1: máy trạng thái chụp
- Bảng 3.3: ma trận phản hồi ba kênh
- Mục 3.1: yêu cầu chức năng và phi chức năng
- Tài liệu tham khảo
- Video demo

---

## D. Bố cục đề xuất

**17 → 21 slide chính + 5 slide dự phòng.** Với 15–20 phút bảo vệ thì 21 slide là vừa.

Thứ tự chèn:

| Vị trí | Thao tác |
|---|---|
| Sau slide 4 | Chèn ⑤ và ⑥ |
| Slide 5 | Thay bằng ① (sơ đồ kiến trúc) |
| Sau slide 9 | Chèn ③ (khó khăn & cách giải quyết) |
| Slide 10 | Thay bằng ② (ảnh chụp màn hình thật) |
| Trước slide 11 | Chèn ④ (phương pháp thu số liệu) |
| Sau slide 17 | Thêm 5 slide dự phòng |

---

## E. Việc gấp nhất — không phải slide

Toàn bộ **Chương 5 của báo cáo và 4 slide kết quả (11–14) không có một con số đo thật nào** — tất cả là *(điền sau thực nghiệm)*.

Báo cáo còn placeholder ở:

| Vị trí | Nội dung thiếu |
|---|---|
| Bảng 4.1 (tr.30) | Model thiết bị Android và iPhone dùng để thử nghiệm |
| Mục 4.3.1 (tr.32) | Dung lượng trung bình ảnh sau xử lý |
| Mục 4.5.1 (tr.37) | `detectMs` sau khi bật GPU delegate |
| Mục 5.2.1 (tr.42) | Chỉ số thống nhất giữa hai người chấm |
| Mục 5.4 (tr.45) | Chiều dài hành lang thử nghiệm |
| Bảng 5.1–5.5 | Toàn bộ số liệu |

Chỉnh slide thì nhanh. Chạy đủ 4 nhóm thực nghiệm thì không:

1. 40 ảnh caption (BLEU/METEOR/ROUGE-L/CIDEr + Likert 2 người chấm mù)
2. 30 câu hỏi đáp trên 10 ảnh
3. 10 lượt đi hành lang (5 đủ sáng, 5 thiếu sáng)
4. ≥30 lần đo độ trễ, chia đều Wi-Fi và 4G

### Một điểm về cách trình bày hạn chế

Mục 6.2 của báo cáo tự nhận *"hạn chế lớn nhất về phương pháp là chưa thử nghiệm trực tiếp với người khiếm thị"*. Slide 15 diễn đạt nhẹ hơn nhiều: *"chưa đánh giá lâm sàng diện rộng"*.

Nên để slide nói đúng trọng số như báo cáo. Chủ động thừa nhận hạn chế luôn được đánh giá cao hơn là để hội đồng phát hiện.

---

## Phụ lục: các hằng số đã đối chiếu với code

| Hằng số | Giá trị | Tệp |
|---|---|---|
| `OBSTACLE_ASSESSMENT_THROTTLE_MS` | 900 | `src/constants/config.ts` |
| `OBSTACLE_CAPTURE_RESOLUTION` | 640 × 480 | `src/constants/config.ts` |
| `TTS_GUARD_DELAY_MS` | 400 | `src/constants/config.ts` |
| `QA_RELISTEN_DELAY_MS` | 800 | `src/constants/config.ts` |
| `OBSTACLE_SCORE_MIN` | 0.35 | `src/constants/config.ts` |
| `DANGER_AREA_RATIO` | 0.35 | `src/constants/config.ts` |
| `WARNING_AREA_RATIO` | 0.18 | `src/constants/config.ts` |
| `ANNOUNCE_COOLDOWN_MS` | danger 2000 · warning 3000 | `src/constants/config.ts` |
| `AppPhase` | `idle` \| `capturing` \| `analyzing` \| `speaking` | `src/state/captureMachine.ts` |
| `COCO_90_LABELS` | 90 phần tử, 10 ô ghost | `src/constants/cocoLabels.ts` |
| `MOCK_MODE` | `false` | `src/constants/config.ts` |
