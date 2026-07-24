# BÁO CÁO KỸ THUẬT: HỆ THỐNG AI OFFLINE PHÁT HIỆN VẬT CẢN ON-DEVICE (SSD MOBILENET TFLITE)

---

## 1. TỔNG QUAN KIẾN TRÚC MÔ HÌNH AI ON-DEVICE

Hệ thống **VisionVoice** ứng dụng con đường kiến trúc **AI On-Device chuẩn công nghiệp**:
- **Mô hình Mạng Nơ-ron Deep Learning**: `SSD MobileNet v1 COCO` (`detect.tflite`, dung lượng ~4 MB).
- **Thư viện Thực thi (Inference Engine)**: `react-native-fast-tflite` + `react-native-nitro-modules` liên kết với NPU/GPU thiết bị Android qua NNAPI/GPU Delegates.
- **Tốc độ suy luận (Inference Speed)**: **15ms – 25ms / frame** (đạt 30 – 60 FPS thời gian thực).

---

## 2. NGUYÊN LÝ HOẠT ĐỘNG & THUẬT TOÁN TÍNH TỶ LỆ CHE PHỦ (BOUNDING BOX RATIO)

### 2.1. Suy luận Mô hình AI (Inference)
Trên từng Video Frame của Camera:
1. Frame được đẩy trực tiếp vào luồng Native C++ GPU/NPU qua hàm `runSync([buffer])`.
2. Mô hình AI trả về 4 Tensor dữ liệu:
   - `locations`: Tọa độ Bounding Box của các đối tượng dạng chuẩn hóa $[y_{\min}, x_{\min}, y_{\max}, x_{\max}] \in [0, 1]$.
   - `classes`: Mã định danh lớp vật thể (0: Person, 56: Chair, 60: Dining Table, 62: TV, 67: Cellphone, v.v.).
   - `scores`: Độ tin cậy dự đoán (Confidence Score $\in [0.0, 1.0]$).

### 2.2. Lọc Ngưỡng Tin Cậy & Bộ Lọc Phông Nền
Chỉ xét các vật thể có độ tin cậy AI:
$$\text{Score}_i \ge 0.35 \quad (35\%)$$

Kích thước và Tỷ lệ diện tích Bounding Box vật thể $i$:
$$w_i = x_{\max, i} - x_{\min, i}, \quad h_i = y_{\max, i} - y_{\min, i}$$
$$\text{Ratio}_i = w_i \times h_i$$

Bộ lọc loại bỏ phông nền tường/sàn che phủ toàn bộ màn hình ở xa:
$$\text{IsBackground}_i = (\text{Ratio}_i > 0.70) \land (x_{\min, i} \le 0.08) \land (y_{\min, i} \le 0.08)$$

Tỷ lệ diện tích chiếm dụng nguy hiểm lớn nhất:
$$\text{MaxRatio} = \max_{\{i \mid \text{Score}_i \ge 0.35 \land \neg \text{IsBackground}_i\}} (\text{Ratio}_i)$$

---

## 3. PHÂN LOẠI MỨC ĐỘ NGUY HIỂM & CẢNH BÁO TÍCH THỜI

$$\text{ThreatLevel} = 
\begin{cases} 
\text{Safe (An toàn)}, & \text{nếu } \text{MaxRatio} < 18\% \ (0.18) \\ 
\text{Warning (Cảnh báo)}, & \text{nếu } 18\% \le \text{MaxRatio} < 35\% \ (0.35) \\ 
\text{Danger (Nguy hiểm)}, & \text{nếu } \text{MaxRatio} \ge 35\% \ (0.35) 
\end{cases}$$

- **Safe (Sàn nhà / Không gian trống)**: AI trả về 0% $\rightarrow$ Im lặng hoàn toàn.
- **Warning (Vật cản tiếp cận từ xa)**: Rung nhẹ cảnh báo (`Haptics Medium`).
- **Danger (Vật cản cận cảnh sát người)**: Rung mạnh nguy hiểm (`Haptics Error`) + Phát âm thanh tiếng Việt: **"Vật cản ở rất gần!"**.

---

## 4. TÓM TẮT KỊCH BẢN THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN (QUICK PRESENTATION SCRIPT)

> *"Kính thưa Hội đồng, trong luồng Offline phát hiện vật cản, em tích hợp mô hình Mạng Nơ-ron Deep Learning SSD MobileNet v1 nạp trực tiếp On-Device chạy trên NPU/GPU di động thông qua TensorFlow Lite.*
>
> *Mô hình AI liên tục phân tích camera frame với tốc độ 30–60 FPS. Khi camera hướng vào sàn nhà hay không gian trống, AI tự động xác định là Background và giữ hệ thống ở mức SAFE im lặng. Khi xuất hiện các vật thể thực tế như chân bàn, cái ghế, bàn tay hay người đứng chắn lối di chuyển, AI lập tức tạo Bounding Box $W \times H$ và tính tỷ lệ che phủ.*
>
> *Nếu tỷ lệ đạt từ $18\%$ máy sẽ rung nhẹ nhắc nhở, và khi đạt từ $35\%$ trở lên (vật cản cận sát người dùng dưới 1m), máy sẽ kích hoạt rung mạnh kèm cảnh báo giọng nói tiếng Việt 'Vật cản ở rất gần!'."*
