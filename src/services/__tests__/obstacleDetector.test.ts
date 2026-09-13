import {
  OBSTACLE_CONFIRM_FRAMES,
  OBSTACLE_LABEL_SCORE_MIN,
  OBSTACLE_MIN_BOTTOM_RATIO,
} from '../../constants/config';
import {
  assessDetections,
  createAnnouncementPolicy,
} from '../obstacleDetector';
import type { Assessment, DetectedObject } from '../obstacleDetector';

const FRAME = { width: 100, height: 100 };

function makeObject(
  x: number,
  y: number,
  width: number,
  height: number,
  labels: { text: string; confidence: number }[] = [],
): DetectedObject {
  return {
    frame: { origin: { x, y }, size: { x: width, y: height } },
    labels,
  };
}

function makeAssessment(
  severity: Assessment['severity'],
  label: string | null = null,
  areaRatio = 0,
): Assessment {
  return { severity, label, areaRatio };
}

/**
 * Nạp đủ khung để vượt ngưỡng xác nhận mà KHÔNG tiêu mất lần thông báo.
 *
 * Chính sách chỉ cho nói từ khung thứ OBSTACLE_CONFIRM_FRAMES trở đi, nên mọi
 * test về cooldown/chuyển trạng thái đều phải mồi (N − 1) khung trước. Các
 * khung mồi này bị chặn bởi chính bộ đếm xác nhận nên không đổi lastSeverity.
 */
function warmStreak(
  policy: { shouldAnnounce(a: Assessment, now: number): boolean },
  assessment: Assessment,
  now = 0,
): void {
  for (let i = 0; i < OBSTACLE_CONFIRM_FRAMES - 1; i++) {
    policy.shouldAnnounce(assessment, now);
  }
}

describe('assessDetections', () => {
  test('returns safe when there are no objects', () => {
    // Arrange
    const objects: DetectedObject[] = [];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result).toEqual({ severity: 'safe', label: null, areaRatio: 0 });
  });

  test('returns warning at exactly the 0.18 area-ratio boundary', () => {
    // Arrange: 60x30 = 1800 / 10000 = 0.18, centered (center-x = 50)
    const objects = [makeObject(20, 30, 60, 30, [{ text: 'chair', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('warning');
    expect(result.areaRatio).toBe(0.18);
  });

  test('returns safe just below the 0.18 warning boundary', () => {
    // Arrange: 60x29 = 1740 / 10000 = 0.174, centered
    const objects = [makeObject(20, 30, 60, 29, [{ text: 'chair', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('safe');
    expect(result.label).toBeNull();
  });

  test('returns danger at exactly the 0.35 area-ratio boundary', () => {
    // Arrange: 70x50 = 3500 / 10000 = 0.35, centered (center-x = 50)
    const objects = [makeObject(15, 20, 70, 50, [{ text: 'wall', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
    expect(result.areaRatio).toBe(0.35);
  });

  test('returns warning just below the 0.35 danger boundary', () => {
    // Arrange: 70x49 = 3430 / 10000 = 0.343, centered
    const objects = [makeObject(15, 20, 70, 49, [{ text: 'wall', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('warning');
  });

  test('filters out objects whose best confidence is below OBSTACLE_SCORE_MIN', () => {
    // Arrange: large centered bbox but confidence 0.34 < 0.35
    const objects = [makeObject(15, 20, 70, 50, [{ text: 'wall', confidence: 0.34 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result).toEqual({ severity: 'safe', label: null, areaRatio: 0 });
  });

  test('treats objects with an empty labels array as score 1 (kept)', () => {
    // Arrange: unlabeled detection with a danger-sized centered bbox
    const objects = [makeObject(15, 20, 70, 50)];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
    expect(result.label).toBeNull();
  });

  test('ignores an object outside the central band at low sensitivity', () => {
    // Arrange: center-x = 30, low band is [37.5, 62.5] on a 100-wide frame
    const objects = [makeObject(20, 5, 20, 90, [{ text: 'person', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'low');

    // Assert
    expect(result).toEqual({ severity: 'safe', label: null, areaRatio: 0 });
  });

  test('keeps the same object inside the wider band at high sensitivity', () => {
    // Arrange: center-x = 30, high band is [25, 75]; 20x90 = 0.18 area ratio
    const objects = [makeObject(20, 5, 20, 90, [{ text: 'person', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'high');

    // Assert
    expect(result.severity).toBe('warning');
    expect(result.label).toBe('người');
  });

  test('picks the highest severity among multiple objects and maps its label', () => {
    // Arrange: a warning-sized person and a danger-sized chair, both centered
    const objects = [
      makeObject(20, 30, 60, 30, [{ text: 'person', confidence: 0.9 }]),
      makeObject(15, 20, 70, 50, [{ text: 'chair', confidence: 0.8 }]),
    ];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
    expect(result.label).toBe('ghế');
  });

  test('bỏ vật có đáy bbox nằm ở nửa trên khung (ở xa hoặc trên cao)', () => {
    // Arrange: bbox 90×40 = 0.36 thừa sức vào mức danger, tâm nằm giữa khung,
    // nhưng đáy ở y = 40 tức 0.40 < OBSTACLE_MIN_BOTTOM_RATIO. Toạ độ không âm
    // vì parseDetections đã kẹp box về trong khung.
    const objects = [makeObject(5, 0, 90, 40, [{ text: 'car', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert: ô tô bên kia đường không còn bị báo là nguy hiểm.
    expect(result).toEqual({ severity: 'safe', label: null, areaRatio: 0 });
  });

  test('giữ vật có đáy bbox đúng ngay mốc OBSTACLE_MIN_BOTTOM_RATIO', () => {
    // Arrange: đáy đặt đúng mốc — biên phải được tính là nằm trên lối đi.
    const bottom = OBSTACLE_MIN_BOTTOM_RATIO * FRAME.height;
    const objects = [
      makeObject(15, bottom - 50, 70, 50, [{ text: 'wall', confidence: 0.9 }]),
    ];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
  });

  test('không gọi tên vật khi độ tin dưới ngưỡng đặt tên', () => {
    // Arrange: tái hiện đúng ca đo được trên máy — 'tàu hỏa' ở 0,543 giữa
    // phòng làm việc. Vẫn phải cảnh báo, nhưng không được đọc tên ra.
    const objects = [
      makeObject(15, 20, 70, 50, [{ text: 'train', confidence: 0.543 }]),
    ];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
    expect(result.label).toBeNull();
  });

  test('gọi tên vật khi độ tin đạt đúng ngưỡng đặt tên', () => {
    // Arrange
    const objects = [
      makeObject(15, 20, 70, 50, [
        { text: 'tv', confidence: OBSTACLE_LABEL_SCORE_MIN },
      ]),
    ];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
    expect(result.label).toBe('tivi');
  });

  test('returns null label for a label text missing from OBSTACLE.LABEL_VI', () => {
    // Arrange: 'unicorn' has no COCO/Vietnamese mapping
    const objects = [makeObject(15, 20, 70, 50, [{ text: 'unicorn', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium');

    // Assert
    expect(result.severity).toBe('danger');
    expect(result.label).toBeNull();
  });
});

describe('trễ trạng thái mức cảnh báo', () => {
  /** Diện tích ngay dưới ngưỡng danger — chỗ mức từng nhảy qua lại. */
  const JUST_BELOW_DANGER = 60; // 60×57 = 0.342 < 0.35

  test('vào mức danger vẫn cần vượt đủ ngưỡng gốc', () => {
    // Arrange: từ 'safe', diện tích 0,342 chưa đủ 0,35.
    const objects = [
      makeObject(20, 30, JUST_BELOW_DANGER, 57, [{ text: 'tv', confidence: 0.9 }]),
    ];

    // Act
    const result = assessDetections(objects, FRAME, 'medium', 'safe');

    // Assert
    expect(result.severity).toBe('warning');
  });

  test('đã ở danger thì cùng diện tích đó vẫn giữ nguyên danger', () => {
    // Arrange: y hệt khung trên, chỉ khác mức của khung trước. Đây chính là ca
    // đo được trên máy — camera đứng yên, diện tích rung quanh ngưỡng, mức nhảy
    // warning ↔ danger liên tục.
    const objects = [
      makeObject(20, 30, JUST_BELOW_DANGER, 57, [{ text: 'tv', confidence: 0.9 }]),
    ];

    // Act
    const result = assessDetections(objects, FRAME, 'medium', 'danger');

    // Assert
    expect(result.severity).toBe('danger');
  });

  test('tụt hẳn dưới ngưỡng trễ thì mới rời mức danger', () => {
    // Arrange: 60×40 = 0,24 — dưới cả 0,35 × 0,85 = 0,2975.
    const objects = [makeObject(20, 30, 60, 40, [{ text: 'tv', confidence: 0.9 }])];

    // Act
    const result = assessDetections(objects, FRAME, 'medium', 'danger');

    // Assert
    expect(result.severity).toBe('warning');
  });
});

describe('trễ trạng thái + chính sách thông báo, chạy chung', () => {
  /**
   * Dựng lại đúng thứ nghe thấy trên máy: camera GIỮ NGUYÊN hướng vào một vật,
   * diện tích bbox rung nhẹ quanh ngưỡng danger, app đổi giọng liên tục.
   *
   * Mốc thời gian lấy thẳng từ log (run 2), quy về gốc tại khung f6:
   * f6 danger(0) … f9 warning(2176) → f10 danger(2889). Hai lần cuối chỉ cách
   * nhau 713 ms nên câu sau cắt cụt câu trước.
   *
   * Gọi shouldAnnounce đúng MỘT lần mỗi khung, như vòng quét thật — không mồi
   * bằng warmStreak, vì giữa chuỗi thì lần mồi lại tiêu mất chính lần thông báo
   * cần đo.
   */
  const FRAMES: { at: number; wide: boolean }[] = [
    { at: -737, wide: true },
    { at: 0, wide: true },
    { at: 737, wide: true },
    { at: 1465, wide: true },
    { at: 2176, wide: false }, // diện tích rung xuống dưới ngưỡng một chút
    { at: 2889, wide: true },
  ];

  /** 70×52 = 0,364 (trên ngưỡng 0,35) và 70×49 = 0,343 (ngay dưới). */
  const heightFor = (wide: boolean): number => (wide ? 52 : 49);

  function runSequence(useHysteresis: boolean): string[] {
    const policy = createAnnouncementPolicy();
    let previous: Assessment['severity'] = 'safe';
    const spoken: string[] = [];

    for (const frame of FRAMES) {
      const objects = [
        makeObject(15, 20, 70, heightFor(frame.wide), [
          { text: 'tv', confidence: 0.9 },
        ]),
      ];
      const result = assessDetections(
        objects,
        FRAME,
        'medium',
        useHysteresis ? previous : 'safe',
      );
      previous = result.severity;
      if (policy.shouldAnnounce(result, frame.at)) {
        spoken.push(result.severity);
      }
    }

    return spoken;
  }

  test('không có trễ trạng thái thì mức nhảy và câu sau cắt câu trước', () => {
    // Act: ép previous = 'safe' mỗi khung = hành vi trước khi sửa.
    const spoken = runSequence(false);

    // Assert: đúng chuỗi danger → warning → danger đã đo được trên máy.
    expect(spoken).toEqual(['danger', 'warning', 'danger']);
  });

  test('có trễ trạng thái thì không còn câu tụt mức chen ngang', () => {
    // Act
    const spoken = runSequence(true);

    // Assert: khung rung giữ nguyên danger nên không sinh câu 'warning'; vật
    // vẫn còn đó nên được nhắc lại sau cooldown, và lần danger 713 ms sau đó bị
    // chặn. Nhắc lại vật cản dai dẳng là CỐ Ý, khác hẳn với nhảy mức.
    expect(spoken).toEqual(['danger', 'danger']);
  });
});

describe('createAnnouncementPolicy', () => {
  test('announces on the first transition into warning', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));

    // Act
    const result = policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Assert
    expect(result).toBe(true);
  });

  test('suppresses an identical warning repeat within the 3000 ms cooldown', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 1000);

    // Assert
    expect(result).toBe(false);
  });

  test('re-announces a persisting warning after the cooldown elapses', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 3000);

    // Assert
    expect(result).toBe(true);
  });

  test('suppresses a warning label change within the cooldown, allows it after', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const withinCooldown = policy.shouldAnnounce(
      makeAssessment('warning', 'người', 0.2),
      1000,
    );
    const afterCooldown = policy.shouldAnnounce(
      makeAssessment('warning', 'người', 0.2),
      3000,
    );

    // Assert
    expect(withinCooldown).toBe(false);
    expect(afterCooldown).toBe(true);
  });

  test('escalation to danger bypasses the cooldown immediately', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 100);

    // Assert
    expect(result).toBe(true);
  });

  test('persisting danger respects the 2000 ms danger cooldown after escalation', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('danger', 'ghế', 0.4));
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);

    // Act
    const withinCooldown = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 500);
    const afterCooldown = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 2000);

    // Assert
    expect(withinCooldown).toBe(false);
    expect(afterCooldown).toBe(true);
  });

  test('announces safe once on transition, then stays silent', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('danger', 'ghế', 0.4));
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);
    warmStreak(policy, makeAssessment('safe'), 1600);

    // Act: 1600 ms đủ qua khoảng cách chung giữa hai lần nói.
    const onTransition = policy.shouldAnnounce(makeAssessment('safe'), 1600);
    const repeated = policy.shouldAnnounce(makeAssessment('safe'), 1700);

    // Assert
    expect(onTransition).toBe(true);
    expect(repeated).toBe(false);
  });

  test('một khung nhiễu lẻ không đủ để báo nguy hiểm', () => {
    // Arrange
    const policy = createAnnouncementPolicy();

    // Act: đúng một khung thấy danger rồi khung sau đã trống trở lại.
    const single = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);

    // Assert
    expect(single).toBe(false);
  });

  test('chuỗi bị ngắt bởi một khung trống thì phải đếm lại từ đầu', () => {
    // Arrange: danger, trống, danger — không khung danger nào liên tiếp đủ N.
    const policy = createAnnouncementPolicy();
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);
    policy.shouldAnnounce(makeAssessment('safe'), 100);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 200);

    // Assert
    expect(result).toBe(false);
  });

  test('warning và danger xen kẽ vẫn tích luỹ đủ xác nhận, không kẹt im lặng', () => {
    // Arrange: severity dao động là chuyện thường khi bbox rung quanh ngưỡng.
    // Đếm theo từng mức sẽ không bao giờ đủ N và app im lặng vĩnh viễn — mà
    // im lặng bị hiểu thành "đường trống".
    const policy = createAnnouncementPolicy();
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 100);

    // Assert
    expect(result).toBe(true);
  });

  test('đường trống cũng cần đủ khung xác nhận mới báo', () => {
    // Arrange: vật cản biến mất đúng một khung rồi hiện lại — không được phép
    // chen câu "Đường trống." vào giữa.
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('danger', 'ghế', 0.4));
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);

    // Act
    const flicker = policy.shouldAnnounce(makeAssessment('safe'), 100);

    // Assert
    expect(flicker).toBe(false);
  });

  test('tụt mức danger xuống warning không được chen ngang câu vừa nói', () => {
    // Arrange: đúng chuỗi đo được trên máy — danger rồi warning chỉ 691 ms sau,
    // cắt ngang câu cảnh báo đang đọc dở.
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('danger', 'tivi', 0.4));
    policy.shouldAnnounce(makeAssessment('danger', 'tivi', 0.4), 0);

    // Act
    const downgrade = policy.shouldAnnounce(makeAssessment('warning', 'ô tô', 0.2), 691);

    // Assert
    expect(downgrade).toBe(false);
  });

  test('chặn tụt mức cắt luôn cả chuỗi dao động phía sau', () => {
    // Arrange: danger(0) → warning(691) → danger(1398) là chuỗi thật trong log.
    // Chặn câu warning giữ lastSeverity ở 'danger', nên lần danger sau không
    // còn là leo thang và rơi vào cooldown 2000 ms của chính nó.
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('danger', 'tivi', 0.4));
    policy.shouldAnnounce(makeAssessment('danger', 'tivi', 0.4), 0);
    policy.shouldAnnounce(makeAssessment('warning', 'ô tô', 0.2), 691);

    // Act
    const reDanger = policy.shouldAnnounce(makeAssessment('danger', null, 0.4), 1398);

    // Assert
    expect(reDanger).toBe(false);
  });

  test('leo thang lên danger vẫn được cắt ngang, dù chưa đủ khoảng cách chung', () => {
    // Arrange: đây là ngoại lệ an toàn — sắp đâm vào vật thì phải nói ngay.
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const escalation = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 732);

    // Assert
    expect(escalation).toBe(true);
  });

  test('danger sau khi đã trống vẫn phải chờ hết cooldown của chính nó', () => {
    // Arrange: danger(0) → safe(1600) → danger(1700). Trước đây lần danger sau
    // được miễn cooldown vì tính là "leo thang". Ngoại lệ đó bị bỏ: nó chỉ thực
    // sự cho qua các lần leo thang GIẢ do mức nhảy qua lại, mà lần danger đầu
    // tiên thì đã qua cooldown sẵn nên chẳng cần tới nó.
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('danger', 'ghế', 0.4));
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);
    warmStreak(policy, makeAssessment('safe'), 1600);
    policy.shouldAnnounce(makeAssessment('safe'), 1600);

    // Act
    const withinCooldown = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 1700);
    const afterCooldown = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 2100);

    // Assert
    expect(withinCooldown).toBe(false);
    expect(afterCooldown).toBe(true);
  });

  test('lần danger đầu tiên luôn được nói ngay, không phải chờ gì', () => {
    // Arrange: đây là ca mà ngoại lệ "leo thang" từng phục vụ — phải vẫn chạy.
    const policy = createAnnouncementPolicy();
    warmStreak(policy, makeAssessment('warning', 'ghế', 0.2));
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act: warning vừa nói xong 300 ms trước, chưa qua khoảng cách chung.
    const firstDanger = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 300);

    // Assert
    expect(firstDanger).toBe(true);
  });
});
