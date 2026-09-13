// Pure obstacle assessment logic — no React, no Expo imports.
// Consumes object-detection results and decides severity + announcements.

import {
  ANNOUNCE_COOLDOWN_MS,
  CENTER_BAND_WIDTH_RATIO,
  DANGER_AREA_RATIO,
  OBSTACLE_CONFIRM_FRAMES,
  OBSTACLE_LABEL_SCORE_MIN,
  OBSTACLE_MIN_ANNOUNCE_GAP_MS,
  OBSTACLE_MIN_BOTTOM_RATIO,
  OBSTACLE_SCORE_MIN,
  WARNING_AREA_RATIO,
} from '../constants/config';
import { OBSTACLE } from '../constants/strings';
import type { ObstacleSensitivity } from '../state/SettingsContext';

/**
 * Structural alias for detected objects. Shape matches the output of
 * tfliteDetector.parseDetections() — frame origin/size in pixels,
 * labels with confidence scores. Declared locally so this module stays
 * decoupled from the native detection package.
 */
export interface DetectedObjectLabel {
  text: string;
  confidence: number;
}

export interface DetectedObject {
  frame: {
    origin: { x: number; y: number };
    size: { x: number; y: number };
  };
  labels: readonly DetectedObjectLabel[];
}

export interface FrameSize {
  width: number;
  height: number;
}

export type Severity = 'safe' | 'warning' | 'danger';

export interface Assessment {
  severity: Severity;
  label: string | null;
  areaRatio: number;
}

export interface AnnouncementPolicy {
  shouldAnnounce(assessment: Assessment, now: number): boolean;
}

const SAFE_ASSESSMENT: Assessment = { severity: 'safe', label: null, areaRatio: 0 };

const SEVERITY_RANK: Record<Severity, number> = { safe: 0, warning: 1, danger: 2 };

/**
 * tfliteDetector always emits exactly one label carrying the detection's real
 * confidence (with an empty `text` when the class index is outside COCO), so
 * the empty-`labels` branch below is only a defensive fallback. It keeps the
 * historical meaning: an unlabeled detection is still a physical obstacle, so
 * it is treated as score 1 and always passes the confidence filter.
 */
function getObjectScore(object: DetectedObject): number {
  if (object.labels.length === 0) {
    return 1;
  }
  return object.labels.reduce(
    (max, label) => (label.confidence > max ? label.confidence : max),
    0,
  );
}

/**
 * Tên tiếng Việt của vật, hoặc null khi không đủ tin để gọi tên.
 *
 * Độ tin thấp thì model đoán bừa tên chứ không sai chỗ "có vật hay không" — xem
 * OBSTACLE_LABEL_SCORE_MIN. Trả null làm người gọi đọc câu trống thay vì bịa ra
 * "tàu hỏa" giữa phòng làm việc; cảnh báo vẫn còn nguyên.
 */
function getBestLabelVi(object: DetectedObject): string | null {
  if (object.labels.length === 0) {
    return null;
  }
  const best = object.labels.reduce((top, label) =>
    label.confidence > top.confidence ? label : top,
  );
  if (best.confidence < OBSTACLE_LABEL_SCORE_MIN) {
    return null;
  }
  const key = best.text.trim().toLowerCase();
  return OBSTACLE.LABEL_VI[key] ?? null;
}

function isInCenterBand(
  object: DetectedObject,
  frameWidth: number,
  sensitivity: ObstacleSensitivity,
): boolean {
  const bandWidth = CENTER_BAND_WIDTH_RATIO[sensitivity] * frameWidth;
  const bandStart = (frameWidth - bandWidth) / 2;
  const bandEnd = bandStart + bandWidth;
  const centerX = object.frame.origin.x + object.frame.size.x / 2;
  return centerX >= bandStart && centerX <= bandEnd;
}

/**
 * Vật có nằm trên lối đi không, xét theo trục dọc.
 *
 * Bổ sung cho isInCenterBand (trục ngang): với camera đeo ngực hướng thẳng,
 * vật đặt trên mặt đất càng gần thì cạnh đáy bbox càng tụt thấp trong khung.
 * Đáy nằm ở nửa trên khung nghĩa là ở xa, hoặc ở trên cao ngoài lối đi.
 */
function isOnWalkingPath(object: DetectedObject, frameHeight: number): boolean {
  const bottom = object.frame.origin.y + object.frame.size.y;
  return bottom / frameHeight >= OBSTACLE_MIN_BOTTOM_RATIO;
}

function toSeverity(areaRatio: number): Severity {
  if (areaRatio >= DANGER_AREA_RATIO) {
    return 'danger';
  }
  if (areaRatio >= WARNING_AREA_RATIO) {
    return 'warning';
  }
  return 'safe';
}

/**
 * Assess a frame of detections. Objects must (1) score >= OBSTACLE_SCORE_MIN,
 * (2) have their bbox center-x inside the central band whose width is
 * CENTER_BAND_WIDTH_RATIO[sensitivity] * frame.width, and (3) have their bbox
 * BOTTOM edge at or below OBSTACLE_MIN_BOTTOM_RATIO of the frame height —
 * see isOnWalkingPath(). Severity comes from the
 * bbox-to-frame area ratio; the highest severity wins (ties broken by larger
 * area). `safe` assessments always carry a null label — the safe phrase never
 * names an object. Labels are mapped through OBSTACLE.LABEL_VI; unknown → null.
 */
export function assessDetections(
  objects: readonly DetectedObject[],
  frame: FrameSize,
  sensitivity: ObstacleSensitivity,
): Assessment {
  if (frame.width <= 0 || frame.height <= 0) {
    return SAFE_ASSESSMENT;
  }

  const frameArea = frame.width * frame.height;
  let best: Assessment = SAFE_ASSESSMENT;

  for (const object of objects) {
    if (getObjectScore(object) < OBSTACLE_SCORE_MIN) {
      continue;
    }
    if (!isInCenterBand(object, frame.width, sensitivity)) {
      continue;
    }
    if (!isOnWalkingPath(object, frame.height)) {
      continue;
    }

    const areaRatio = (object.frame.size.x * object.frame.size.y) / frameArea;
    const severity = toSeverity(areaRatio);
    const isMoreSevere = SEVERITY_RANK[severity] > SEVERITY_RANK[best.severity];
    const isLargerAtSameSeverity =
      severity === best.severity && areaRatio > best.areaRatio;

    if (isMoreSevere || isLargerAtSameSeverity) {
      best = {
        severity,
        label: severity === 'safe' ? null : getBestLabelVi(object),
        areaRatio,
      };
    }
  }

  return best;
}

/**
 * Stateful (closure-encapsulated) announcement gate.
 *
 * Rules:
 * - A transition (different severity, or different label at the same severity)
 *   announces, but respects the per-severity cooldown (danger 2000 ms,
 *   warning 3000 ms since that severity was last announced).
 * - Escalation TO danger (previous severity !== danger) bypasses the cooldown —
 *   once per transition; while danger persists the danger cooldown applies.
 * - `safe` announces only on the transition into safe, then stays silent.
 * - KHOẢNG CÁCH CHUNG: hai lần nói bất kỳ phải cách nhau
 *   OBSTACLE_MIN_ANNOUNCE_GAP_MS, vì cooldown riêng từng mức không chặn được
 *   severity dao động — leo thang lên danger là ngoại lệ duy nhất.
 * - An identical (severity, label) repeat within its cooldown is suppressed;
 *   after the cooldown it re-announces (a persisting obstacle is re-warned).
 *
 * - XÁC NHẬN THEO KHUNG: phải có OBSTACLE_CONFIRM_FRAMES khung liên tiếp cùng
 *   thấy vật cản (hoặc cùng thấy đường trống) thì mới được nói. Một khung nhiễu
 *   lẻ không còn đủ để hét "Dừng lại!". Chuỗi đếm theo CÓ/KHÔNG có vật cản chứ
 *   không theo từng mức, nên warning/danger xen kẽ vẫn tích luỹ được — đếm theo
 *   mức sẽ kẹt im lặng vĩnh viễn khi severity dao động.
 *
 * State only updates when an announcement is allowed, so a suppressed
 * transition is retried on later frames until its cooldown expires.
 *
 * Note: at an unchanged severity, the cooldown alone decides — both a label
 * change and an identical repeat wait for the same per-severity cooldown, so
 * the last label is not tracked; it only changes the phrase spoken by callers.
 */
export function createAnnouncementPolicy(): AnnouncementPolicy {
  let lastSeverity: Severity | null = null;
  let lastDangerAt = Number.NEGATIVE_INFINITY;
  let lastWarningAt = Number.NEGATIVE_INFINITY;
  let hazardStreak = 0;
  let safeStreak = 0;
  let lastAnnounceAt = Number.NEGATIVE_INFINITY;

  return {
    shouldAnnounce(assessment: Assessment, now: number): boolean {
      const { severity } = assessment;

      if (severity === 'safe') {
        safeStreak++;
        hazardStreak = 0;
        if (safeStreak < OBSTACLE_CONFIRM_FRAMES) {
          return false;
        }
        if (lastSeverity === 'safe') {
          return false;
        }
        if (now - lastAnnounceAt < OBSTACLE_MIN_ANNOUNCE_GAP_MS) {
          return false;
        }
        lastSeverity = 'safe';
        lastAnnounceAt = now;
        return true;
      }

      hazardStreak++;
      safeStreak = 0;
      if (hazardStreak < OBSTACLE_CONFIRM_FRAMES) {
        return false;
      }

      if (severity === 'danger') {
        // Leo thang lên danger được miễn cả cooldown lẫn khoảng cách tối thiểu:
        // sắp đâm vào vật thì cắt ngang câu đang nói mới đúng.
        const isEscalation = lastSeverity !== 'danger';
        const isCooldownOver = now - lastDangerAt >= ANNOUNCE_COOLDOWN_MS.danger;
        if (!isEscalation && !isCooldownOver) {
          return false;
        }
        lastSeverity = 'danger';
        lastDangerAt = now;
        lastAnnounceAt = now;
        return true;
      }

      // warning — phải qua CẢ cooldown riêng của mức lẫn khoảng cách chung.
      // Thiếu vế sau thì một lần tụt mức danger → warning sẽ chen ngay vào giữa
      // câu cảnh báo nguy hiểm vừa nói, rồi kéo theo cả chuỗi cắt xén.
      const isCooldownOver = now - lastWarningAt >= ANNOUNCE_COOLDOWN_MS.warning;
      if (!isCooldownOver) {
        return false;
      }
      if (now - lastAnnounceAt < OBSTACLE_MIN_ANNOUNCE_GAP_MS) {
        return false;
      }
      lastSeverity = 'warning';
      lastWarningAt = now;
      lastAnnounceAt = now;
      return true;
    },
  };
}
