# HƯỚNG DẪN DEMO ỨNG DỤNG VISIONVOICE VỚI GRIT MODEL (COLAB BACKEND)

Chào bạn! Dưới đây là hướng dẫn chi tiết cách vận hành và demo luồng thực tế của ứng dụng di động **VisionVoice** kết hợp với mô hình **GRIT** đã fine-tune trên tập dữ liệu tiếng Việt **KTVIC**, chạy trực tiếp qua máy chủ Google Colab.

---

## 🚀 Các cải tiến đã triển khai trong Source Code

Chúng tôi đã nâng cấp toàn bộ hệ thống kết nối API và giao diện hiển thị của mobile app để đảm bảo buổi demo diễn ra **mượt mà, chuyên nghiệp và có tính thuyết phục cao nhất**:

### 1. Nâng cấp API Client (`src/services/api.ts`)

- **Hỗ trợ Endpoint `/caption`**: Tự động gọi API `/caption` theo kế hoạch demo. Nếu máy chủ chưa cập nhật và báo lỗi `404`, hệ thống sẽ tự động chuyển hướng dự phòng (fallback) sang `/api/analyze` để không làm gián đoạn demo.
- **Tự động nhận diện cả 2 Key**: Xử lý mượt mà cả cấu trúc JSON mới trả về của Colab (`{"caption": "..."}`) và cấu trúc cũ (`{"description": "..."}`).
- **Hỗ trợ cập nhật URL động**: Cung cấp hàm `updateApiBaseUrl` để cập nhật địa chỉ IP/Ngrok của máy chủ Axios ngay khi đang chạy ứng dụng.

### 2. Giao diện Demo Đa phương thức (`src/screens/CameraScreen.tsx`)

- **Chọn ảnh từ Thư viện (Gallery)**: Bổ sung nút mở thư viện ảnh (`expo-image-picker`) tinh tế bên cạnh nút chụp, đáp ứng mục tiêu cho phép người dùng chọn ảnh có sẵn để test.
- **Màn hình hiển thị kết quả cực kỳ cao cấp (Premium Glassmorphism)**:
  - Thay vì tự động reset ngay lập tức, app sẽ chuyển sang màn hình xem kết quả.
  - Ảnh chụp/chọn được hiển thị sắc nét trong khung viền bo cong có bóng đổ phát sáng (Glow border).
  - Caption tiếng Việt sinh ra bởi mô hình GRIT được trình bày trang trọng trong thẻ **Glassmorphic** nền mờ sang xịn.
- **Nút "Đọc mô tả" (TTS - Text-to-Speech) thông minh**:
  - Cho phép người dùng chạm để nghe máy đọc hoặc chạm lần nữa để dừng đọc (`Play/Pause`).
  - Có hiệu ứng màu sắc thay đổi động khi đang phát âm thanh để tăng tính tương tác.
- **Hộp thoại Cấu hình Máy chủ Colab động**:
  - Một nút **Settings (Bánh răng)** tinh xảo trên góc phải HUD.
  - Chạm vào sẽ mở Modal cho phép **dán trực tiếp địa chỉ Ngrok hoặc Cloudflared mới** mà không cần sửa code hay rebuild lại ứng dụng.
- **Hỗ trợ Điều khiển rảnh tay bằng Giọng nói (Voice Control)**:
  - Khi ở camera: Nói _"Chụp"_ hoặc _"Chụp ảnh"_ để kích hoạt.
  - Khi ở kết quả: Nói _"Quay lại"_, _"Chụp tiếp"_, hoặc _"Thử lại"_ để quay lại màn hình máy ảnh; nói _"Đọc lại"_, _"Nghe lại"_ để TTS đọc lại mô tả.

---

## 🛠️ Hướng dẫn Từng Bước Chạy Demo

### Bước 1: Chuẩn bị mô hình & Chạy Backend trên Google Colab

Trên Notebook Colab của bạn, hãy viết một script FastAPI hoặc Flask đơn giản chạy bằng GPU để tải checkpoint `full_train_epoch3_model.pth` và sinh caption.

Dưới đây là code backend gợi ý bằng **FastAPI** cực kỳ gọn nhẹ:

```python
import os
import torch
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io

app = FastAPI()

# Cấu hình CORS để app di động truy cập được
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Tải mô hình GRIT đã fine-tune của nhóm bạn tại đây
print("Loading GRIT fine-tuned checkpoint...")
# model = load_your_grit_model("full_train_epoch3_model.pth")
# model.eval()

@app.post("/caption")
async def generate_caption(image: UploadFile = File(...)):
    try:
        # Đọc dữ liệu ảnh từ request gửi lên
        image_data = await image.read()
        pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")

        # 2. Thực hiện inference mô hình GRIT
        # caption_vietnamese = model.predict(pil_image)
        caption_vietnamese = "có một người phụ nữ đang đứng bên quầy hàng"  # Ví dụ mẫu trả về

        return {"caption": caption_vietnamese}
    except Exception as e:
        return {"error": str(e)}, 500

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Bước 2: Tạo Public URL qua Ngrok / Cloudflared trên Colab

Chạy lệnh sau trên một cell Colab mới để chuyển hướng cổng API `8000` ra internet công cộng:

**Sử dụng Ngrok:**

```python
!pip install pyngrok
from pyngrok import ngrok
# Thiết lập authtoken của bạn
ngrok.set_auth_token("YOUR_NGROK_AUTHTOKEN")
public_url = ngrok.connect(8000)
print("Public API URL:", public_url.public_url)
```

**Hoặc sử dụng Cloudflared (Miễn phí, không cần token):**

```bash
!wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
!dpkg -i cloudflared-linux-amd64.deb
!cloudflared tunnel --url http://127.0.0.1:8000
```

_Hãy copy đường dẫn public dạng `https://xxxx.ngrok-free.app` hoặc `https://xxxx.trycloudflare.com` được in ra màn hình._

---

### Bước 3: Cấu hình URL vào Mobile App & Trình diễn Luồng Demo

1. Khởi động Mobile App (`npm start` hoặc `expo start`).
2. Trên màn hình máy ảnh của ứng dụng, chạm vào biểu tượng **bánh răng cài đặt (Settings)** ở góc trên bên phải.
3. **Dán địa chỉ public URL** đã copy ở Bước 2 vào ô nhập liệu.
4. Nhấn **CẬP NHẬT**. Ứng dụng sẽ phản hồi bằng giọng nói: _"Đã cập nhật cấu hình kết nối mới thành công."_
5. **Trình diễn kịch bản:**
   - **Cách 1 (Chụp trực tiếp)**: Đưa máy ảnh lên, nhấn nút chụp hoặc nói to _"Chụp ảnh"_. App sẽ chụp, hiện overlay loading _"GRIT đang phân tích..."_, nhận caption từ Colab, hiển thị ảnh sắc nét kèm caption tiếng Việt trên thẻ Glassmorphic và tự động đọc to mô tả đó.
   - **Cách 2 (Chọn từ gallery)**: Nhấn nút thư viện bên trái nút chụp, chọn một bức ảnh chuẩn bị sẵn. App gửi lên backend Colab, hiển thị ảnh cùng kết quả sinh caption và hỗ trợ nút _"Đọc lại mô tả"_ vô cùng tiện lợi.
   - Để demo tiếp ảnh khác, chỉ cần nói _"Quay lại"_ hoặc ấn nút _"CHỤP ẢNH MỚI"_ để trở lại camera trực tiếp!

---

💡 **Lời khuyên cho buổi demo thành công:**

- Chuẩn bị sẵn từ 3 - 5 bức ảnh có độ sáng tốt, bố cục rõ ràng để mô hình GRIT sinh caption ổn định nhất.
- Nhắc nhở hội đồng đánh giá đây là phiên bản thử nghiệm thực tế (prototype/demo) sử dụng hạ tầng Colab để chạy GPU hiệu năng cao phục vụ trình diễn.
- Test trước micro và loa của thiết bị di động để tính năng giọng nói (TTS) hoạt động tốt nhất.

Chúc nhóm bạn có một buổi báo cáo đồ án thành công rực rỡ! 🎉
