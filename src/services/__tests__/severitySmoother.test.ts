import { OBSTACLE_SEVERITY_HOLD_MS } from '../../constants/config';
import type { Assessment } from '../obstacleDetector';
import { createSeveritySmoother } from '../severitySmoother';

const SAFE: Assessment = { severity: 'safe', label: null, areaRatio: 0 };
const DANGER: Assessment = { severity: 'danger', label: 'ghế', areaRatio: 0.3 };
const WARNING: Assessment = { severity: 'warning', label: 'ghế', areaRatio: 0.1 };

/** Nhịp quét thật đo trên máy, ~1 khung mỗi giây. */
const FRAME_MS = 1000;

/** Đẩy một chuỗi khung thô qua bộ làm mượt, trả mức đã làm mượt của từng khung. */
function run(frames: Assessment[], startAt = 0): Assessment['severity'][] {
  const smoother = createSeveritySmoother();
  return frames.map((raw, i) => smoother.update(raw, startAt + i * FRAME_MS).severity);
}

describe('createSeveritySmoother', () => {
  test('một khung nhiễu lẻ không đổi trạng thái', () => {
    // Act: đúng một khung thấy danger, khung sau trống.
    const out = run([SAFE, DANGER, SAFE, SAFE]);

    // Assert: màn hình và giọng nói không hề thấy danger.
    expect(out).toEqual(['safe', 'safe', 'safe', 'safe']);
  });

  test('hai khung liên tiếp mới xác nhận lên mức', () => {
    // Act
    const out = run([DANGER, DANGER]);

    // Assert
    expect(out).toEqual(['safe', 'danger']);
  });

  test('chuỗi bị ngắt bởi một khung trống thì phải đếm lại từ đầu', () => {
    // Act: danger, trống, danger — không có hai khung hazard liên tiếp.
    const out = run([DANGER, SAFE, DANGER]);

    // Assert
    expect(out).toEqual(['safe', 'safe', 'safe']);
  });

  test('warning và danger xen kẽ vẫn tích luỹ đủ xác nhận', () => {
    // Act: đếm theo có/không có vật cản, không theo từng mức.
    const out = run([WARNING, DANGER]);

    // Assert
    expect(out).toEqual(['safe', 'danger']);
  });

  test('vật mất một khung giữa chuỗi danger thì vẫn giữ danger', () => {
    // Act: đúng triệu chứng trên máy — nguy hiểm → an toàn → nguy hiểm.
    const out = run([DANGER, DANGER, SAFE, DANGER, DANGER]);

    // Assert: không bao giờ rơi về safe.
    expect(out).toEqual(['safe', 'danger', 'danger', 'danger', 'danger']);
  });

  test('đang giữ warning thì một khung danger lẻ không được leo thang', () => {
    // Act: warning đã xác nhận, mất một khung, rồi đúng một khung danger.
    const out = run([WARNING, WARNING, SAFE, DANGER]);

    // Assert: gia hạn warning chứ không nhảy lên danger khi chưa đủ xác nhận.
    expect(out).toEqual(['safe', 'warning', 'warning', 'warning']);
  });

  test('vật biến mất thật thì về safe sau thời gian giữ', () => {
    // Arrange
    const smoother = createSeveritySmoother();
    smoother.update(DANGER, 0);
    smoother.update(DANGER, 1000);

    // Act
    const justBefore = smoother.update(SAFE, 1000 + OBSTACLE_SEVERITY_HOLD_MS - 1);
    const after = smoother.update(SAFE, 1000 + OBSTACLE_SEVERITY_HOLD_MS);

    // Assert
    expect(justBefore.severity).toBe('danger');
    expect(after.severity).toBe('safe');
  });

  test('danger hết hạn mà warning còn trong thời gian giữ thì xuống warning', () => {
    // Arrange: vật lùi ra xa — danger rồi warning.
    const smoother = createSeveritySmoother();
    smoother.update(DANGER, 0);
    smoother.update(DANGER, 1000);
    smoother.update(WARNING, 2000);
    smoother.update(WARNING, 3000);

    // Act: danger cuối lúc 1000 đã hết hạn, warning cuối lúc 3000 còn hạn.
    const out = smoother.update(SAFE, 1000 + OBSTACLE_SEVERITY_HOLD_MS);

    // Assert
    expect(out).toEqual(WARNING);
  });

  test('đang giữ warning mà xác nhận danger thì lên ngay', () => {
    // Arrange
    const smoother = createSeveritySmoother();
    smoother.update(WARNING, 0);
    smoother.update(WARNING, 1000);

    // Act
    const out = smoother.update(DANGER, 2000);

    // Assert: chuỗi hazard đã đủ dài nên danger không cần chờ thêm khung.
    expect(out.severity).toBe('danger');
  });

  test('trả về nhãn và diện tích của khung đã xác nhận gần nhất ở mức đó', () => {
    // Arrange
    const smoother = createSeveritySmoother();
    smoother.update(DANGER, 0);
    smoother.update({ severity: 'danger', label: 'người', areaRatio: 0.4 }, 1000);

    // Act: khung trống — vẫn đang giữ, nên lặp lại khung danger cuối.
    const out = smoother.update(SAFE, 1500);

    // Assert
    expect(out).toEqual({ severity: 'danger', label: 'người', areaRatio: 0.4 });
  });
});
