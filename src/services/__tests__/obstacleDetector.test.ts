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

describe('createAnnouncementPolicy', () => {
  test('announces on the first transition into warning', () => {
    // Arrange
    const policy = createAnnouncementPolicy();

    // Act
    const result = policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Assert
    expect(result).toBe(true);
  });

  test('suppresses an identical warning repeat within the 3000 ms cooldown', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 1000);

    // Assert
    expect(result).toBe(false);
  });

  test('re-announces a persisting warning after the cooldown elapses', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 3000);

    // Assert
    expect(result).toBe(true);
  });

  test('suppresses a warning label change within the cooldown, allows it after', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
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
    policy.shouldAnnounce(makeAssessment('warning', 'ghế', 0.2), 0);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 100);

    // Assert
    expect(result).toBe(true);
  });

  test('persisting danger respects the 2000 ms danger cooldown after escalation', () => {
    // Arrange
    const policy = createAnnouncementPolicy();
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
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);

    // Act
    const onTransition = policy.shouldAnnounce(makeAssessment('safe'), 100);
    const repeated = policy.shouldAnnounce(makeAssessment('safe'), 200);

    // Assert
    expect(onTransition).toBe(true);
    expect(repeated).toBe(false);
  });

  test('re-escalation to danger after safe bypasses the danger cooldown', () => {
    // Arrange: danger announced at t=0, safe at t=100, danger again at t=200
    const policy = createAnnouncementPolicy();
    policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 0);
    policy.shouldAnnounce(makeAssessment('safe'), 100);

    // Act
    const result = policy.shouldAnnounce(makeAssessment('danger', 'ghế', 0.4), 200);

    // Assert
    expect(result).toBe(true);
  });
});
