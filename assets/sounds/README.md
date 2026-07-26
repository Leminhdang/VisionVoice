# Âm thanh VisionVoice

4 file WAV 44.1kHz 16-bit mono, tổng hợp bằng script (không cần license):

| File | Dùng cho |
|---|---|
| `shutter.wav` | Tiếng màn trập khi chụp ảnh |
| `listen-start.wav` | Bắt đầu nghe (2 nốt đi lên) |
| `listen-end.wav` | Kết thúc nghe (nốt đi xuống) |
| `danger.wav` | Cảnh báo nguy hiểm (double-beep 880Hz) |

Phát qua `expo-audio` trong `src/services/feedback.ts`. Muốn thay: giữ nguyên tên file, thời lượng ≤400ms.
