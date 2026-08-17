import { COCO_LABELS, COCO_LABEL_VI } from '../cocoLabels';

/**
 * COCO_LABELS phải khớp từng chỉ số với bảng nhãn nhúng trong model.
 * Kiểm chứng lại bằng:
 *   unzip -p assets/models/efficientdet_lite0.tflite labels.txt | cat -n
 *
 * Rút bảng xuống 80 lớp liền mạch (bỏ các ô trống) là lỗi đã từng xảy ra:
 * mọi lớp từ chỉ số 11 trở lên lệch đi, `chair` bị đọc thành `toilet`.
 */
describe('COCO_LABELS khớp bảng nhãn của model', () => {
  test('có đúng 90 phần tử, gồm 10 ô trống', () => {
    // Assert
    expect(COCO_LABELS).toHaveLength(90);
    expect(COCO_LABELS.filter((label) => label === '')).toHaveLength(10);
  });

  test('các chỉ số mốc nằm đúng vị trí', () => {
    // Arrange — lấy từ labels.txt của model, 0-based.
    const expected: ReadonlyArray<[number, string]> = [
      [0, 'person'],
      [10, 'fire hydrant'],
      [11, ''], // ô trống đầu tiên — chỗ bảng 80 lớp bắt đầu lệch
      [12, 'stop sign'],
      [61, 'chair'],
      [62, 'couch'],
      [66, 'dining table'],
      [89, 'toothbrush'],
    ];

    // Assert
    for (const [index, label] of expected) {
      expect(COCO_LABELS[index]).toBe(label);
    }
  });

  test('mọi nhãn không rỗng đều có bản dịch tiếng Việt', () => {
    // Act
    const missing = COCO_LABELS.filter(
      (label) => label !== '' && COCO_LABEL_VI[label] === undefined,
    );

    // Assert
    expect(missing).toEqual([]);
  });

  test('ô trống không tra ra nhãn tiếng Việt nào', () => {
    // Assert — chuỗi rỗng phải là "không rõ vật gì", không phải một tên vật.
    expect(COCO_LABEL_VI['']).toBeUndefined();
  });
});
