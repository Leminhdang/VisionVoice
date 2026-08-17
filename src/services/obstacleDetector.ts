// Pure obstacle assessment logic — no React, no Expo imports.
// Consumes object-detection results and decides severity + announcements.

import {
  ANNOUNCE_COOLDOWN_MS,
  CENTER_BAND_WIDTH_RATIO,
  DANGER_AREA_RATIO,
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

function getBestLabelVi(object: DetectedObject): string | null {
  if (object.labels.length === 0) {
    return null;
  }
  const best = object.labels.reduce((top, label) =>
    label.confidence > top.confidence ? label : top,
  );
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
 * Assess a frame of detections. Objects must (1) score >= OBSTACLE_SCORE_MIN
 * and (2) have their bbox center-x inside the central band whose width is
 * CENTER_BAND_WIDTH_RATIO[sensitivity] * frame.width. Severity comes from the
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
 * - An identical (severity, label) repeat within its cooldown is suppressed;
 *   after the cooldown it re-announces (a persisting obstacle is re-warned).
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

  return {
    shouldAnnounce(assessment: Assessment, now: number): boolean {
      const { severity } = assessment;

      if (severity === 'safe') {
        if (lastSeverity === 'safe') {
          return false;
        }
        lastSeverity = 'safe';
        return true;
      }

      if (severity === 'danger') {
        const isEscalation = lastSeverity !== 'danger';
        const isCooldownOver = now - lastDangerAt >= ANNOUNCE_COOLDOWN_MS.danger;
        if (!isEscalation && !isCooldownOver) {
          return false;
        }
        lastSeverity = 'danger';
        lastDangerAt = now;
        return true;
      }

      // warning
      const isCooldownOver = now - lastWarningAt >= ANNOUNCE_COOLDOWN_MS.warning;
      if (!isCooldownOver) {
        return false;
      }
      lastSeverity = 'warning';
      lastWarningAt = now;
      return true;
    },
  };
}
