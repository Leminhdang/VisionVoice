/**
 * Pure metrics module — no React, module-level state only.
 * Events are kept in an in-memory ring buffer and mirrored to the console
 * (adb logcat collection path) with the 'VVMETRIC ' prefix.
 */

import { METRICS_ENABLED } from '../constants/config';

const RING_BUFFER_CAP = 5000;

export type MetricEvent =
  | { event: 'session_start'; note?: string }
  | {
      event: 'capture_start';
      captureId: number;
      trigger: 'voice' | 'volume' | 'button' | 'gallery';
    }
  | { event: 'api_request'; captureId: number; kind: 'describe' | 'qa' }
  | {
      event: 'api_response';
      captureId: number;
      ok: boolean;
      errorCode?: string;
      mock?: boolean;
    }
  | { event: 'tts_start'; captureId: number; chars: number }
  | { event: 'qa_question'; captureId: number; transcript: string }
  | { event: 'qa_answer'; captureId: number; answer: string }
  | {
      event: 'obstacle_frame';
      frameId: number;
      detectMs: number;
      detections: number;
    }
  // Khung không dò được (model chưa nạp / lỗi inference). Tách khỏi
  // obstacle_frame để số liệu detections không bị pha tạp.
  | { event: 'obstacle_detect_failed'; frameId: number; consecutive: number }
  | {
      event: 'obstacle_alert';
      frameId: number;
      severity: 'warning' | 'danger';
      label: string | null;
    }
  | { event: 'app_error'; where: string; message: string };

type StampedEvent = MetricEvent & { ts: number };

// Ring buffer. A plain array with shift() is deliberate here: obstacle frames
// can log at high frequency and re-allocating a 5000-element array per event
// (immutable slice) would cost more than it protects. Contained mutation only.
const events: StampedEvent[] = [];

let captureIdCounter = 0;
let frameIdCounter = 0;

export function logMetric(e: MetricEvent): void {
  if (!METRICS_ENABLED) {
    return;
  }
  const stamped: StampedEvent = { ts: Date.now(), ...e };
  events.push(stamped);
  if (events.length > RING_BUFFER_CAP) {
    events.shift();
  }
  // eslint-disable-next-line no-console -- INTENTIONAL: adb logcat collection path
  console.log('VVMETRIC ' + JSON.stringify(stamped));
}

export function nextCaptureId(): number {
  captureIdCounter += 1;
  return captureIdCounter;
}

export function nextFrameId(): number {
  frameIdCounter += 1;
  return frameIdCounter;
}

export function getSessionJson(): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), events });
}

export function getQuickSummary(): string {
  const captureCount = events.filter((e) => e.event === 'capture_start').length;
  const questionCount = events.filter((e) => e.event === 'qa_question').length;
  const alertCount = events.filter((e) => e.event === 'obstacle_alert').length;
  const frameCount = events.filter((e) => e.event === 'obstacle_frame').length;
  const avgMs = computeAvgDescribeLatencyMs();
  return (
    `Đã chụp ${captureCount} ảnh, ${questionCount} câu hỏi, ` +
    `${alertCount} cảnh báo, độ trễ mô tả trung bình ${avgMs} mili giây, ` +
    `${frameCount} khung vật cản.`
  );
}

export function clearSession(): void {
  events.length = 0;
}

function computeAvgDescribeLatencyMs(): number {
  const requestTsByCaptureId = new Map<number, number>();
  for (const e of events) {
    if (e.event === 'api_request' && e.kind === 'describe') {
      requestTsByCaptureId.set(e.captureId, e.ts);
    }
  }
  const latencies: number[] = [];
  for (const e of events) {
    if (e.event !== 'api_response') {
      continue;
    }
    const requestTs = requestTsByCaptureId.get(e.captureId);
    if (requestTs !== undefined && e.ts >= requestTs) {
      latencies.push(e.ts - requestTs);
      requestTsByCaptureId.delete(e.captureId);
    }
  }
  if (latencies.length === 0) {
    return 0;
  }
  const total = latencies.reduce((sum, ms) => sum + ms, 0);
  return Math.round(total / latencies.length);
}
