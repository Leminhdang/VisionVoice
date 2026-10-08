// Chuẩn bị khung từ luồng camera cho TFLite — chạy trong worklet của camera.
//
// Frame output trả RGBA_8888 đã xoay sẵn (pixelFormat 'rgb' +
// enablePhysicalBufferRotation), nên ở đây chỉ còn cắt ô vuông giữa khung,
// thu nhỏ và bỏ kênh alpha. Cùng cách cắt với imagePreprocess ở chế độ 'crop',
// nên parseDetections() map box ngược y như đường chụp ảnh tĩnh.

/**
 * Cắt ô vuông ở giữa khung RGBA rồi thu nhỏ nearest-neighbour về
 * size × size RGB, ghi thẳng vào `dst` (độ dài size × size × 3).
 *
 * Nearest-neighbour chứ không nội suy: một vòng lặp, một phép đọc mỗi pixel,
 * vừa sức Hermes không JIT ở ~6 khung/giây. Lấy mẫu ở TÂM ô nguồn để không
 * lệch nửa pixel về góc trên trái.
 *
 * `bytesPerRow` đọc từ frame chứ không tính width × 4: CameraX có thể đệm
 * cuối mỗi hàng.
 */
export function rgbaToSquareRgb(
  src: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  size: number,
  dst: Uint8Array,
): void {
  'worklet';
  const side = Math.min(width, height);
  const startX = Math.floor((width - side) / 2);
  const startY = Math.floor((height - side) / 2);
  const step = side / size;

  let d = 0;
  for (let y = 0; y < size; y++) {
    const row = (startY + Math.floor((y + 0.5) * step)) * bytesPerRow;
    for (let x = 0; x < size; x++) {
      const s = row + (startX + Math.floor((x + 0.5) * step)) * 4;
      dst[d] = src[s];
      dst[d + 1] = src[s + 1];
      dst[d + 2] = src[s + 2];
      d += 3;
    }
  }
}
