import { rgbaToSquareRgb } from '../frameSampler';

/**
 * Dựng một khung RGBA giả: mỗi pixel mã hoá toạ độ của chính nó (R = x,
 * G = y, B = 7, A = 255) để kiểm được pixel nào được lấy mẫu.
 */
function makeRgba(width: number, height: number, bytesPerRow = width * 4): Uint8Array {
  const src = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * bytesPerRow + x * 4;
      src[i] = x;
      src[i + 1] = y;
      src[i + 2] = 7;
      src[i + 3] = 255;
    }
  }
  return src;
}

/** Pixel (x, y) của ô vuông RGB đầu ra. */
function pixelAt(dst: Uint8Array, size: number, x: number, y: number): number[] {
  const i = (y * size + x) * 3;
  return [dst[i], dst[i + 1], dst[i + 2]];
}

describe('rgbaToSquareRgb', () => {
  test('khung đã vuông đúng kích thước thì chép nguyên, bỏ kênh alpha', () => {
    // Arrange
    const src = makeRgba(4, 4);
    const dst = new Uint8Array(4 * 4 * 3);

    // Act
    rgbaToSquareRgb(src, 4, 4, 16, 4, dst);

    // Assert
    expect(pixelAt(dst, 4, 0, 0)).toEqual([0, 0, 7]);
    expect(pixelAt(dst, 4, 3, 2)).toEqual([3, 2, 7]);
  });

  test('khung dọc bị cắt vuông ở giữa theo chiều cao', () => {
    // Arrange: 4×8 → cắt ô vuông 4×4 bắt đầu từ y = 2.
    const src = makeRgba(4, 8);
    const dst = new Uint8Array(4 * 4 * 3);

    // Act
    rgbaToSquareRgb(src, 4, 8, 16, 4, dst);

    // Assert
    expect(pixelAt(dst, 4, 0, 0)).toEqual([0, 2, 7]);
    expect(pixelAt(dst, 4, 3, 3)).toEqual([3, 5, 7]);
  });

  test('khung ngang bị cắt vuông ở giữa theo chiều rộng', () => {
    // Arrange: 8×4 → cắt ô vuông bắt đầu từ x = 2.
    const src = makeRgba(8, 4);
    const dst = new Uint8Array(4 * 4 * 3);

    // Act
    rgbaToSquareRgb(src, 8, 4, 32, 4, dst);

    // Assert
    expect(pixelAt(dst, 4, 0, 0)).toEqual([2, 0, 7]);
    expect(pixelAt(dst, 4, 3, 1)).toEqual([5, 1, 7]);
  });

  test('thu nhỏ lấy pixel gần tâm ô nguồn', () => {
    // Arrange: 8×8 → 4×4, mỗi ô đích phủ 2×2 nguồn, lấy mẫu tại (2k + 1).
    const src = makeRgba(8, 8);
    const dst = new Uint8Array(4 * 4 * 3);

    // Act
    rgbaToSquareRgb(src, 8, 8, 32, 4, dst);

    // Assert
    expect(pixelAt(dst, 4, 0, 0)).toEqual([1, 1, 7]);
    expect(pixelAt(dst, 4, 3, 3)).toEqual([7, 7, 7]);
  });

  test('tôn trọng bytesPerRow có đệm cuối hàng', () => {
    // Arrange: mỗi hàng có 8 byte rác ở cuối.
    const src = makeRgba(4, 4, 24);
    const dst = new Uint8Array(4 * 4 * 3);

    // Act
    rgbaToSquareRgb(src, 4, 4, 24, 4, dst);

    // Assert
    expect(pixelAt(dst, 4, 2, 3)).toEqual([2, 3, 7]);
  });
});
