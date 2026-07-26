#!/usr/bin/env node
/**
 * Phân tích nhật ký VVMETRIC xuất từ app (Settings → Xuất nhật ký đánh giá)
 * hoặc dump logcat (adb logcat -s ReactNativeJS:I | grep VVMETRIC > run1.log).
 *
 * Cách dùng:  node scripts/parse-metrics.mjs run1.json [run2.log ...]
 * Đầu ra:     bảng tóm tắt trên stdout + file eval/results/metrics-summary.csv
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'eval', 'results');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Cách dùng: node scripts/parse-metrics.mjs <file-json-hoặc-log> [...]');
  process.exit(1);
}

function parseFile(path) {
  const raw = readFileSync(path, 'utf8');
  // File JSON xuất từ app: { exportedAt, events: [...] }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.events)) return parsed.events;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Không phải JSON — coi như dump logcat, bóc phần sau 'VVMETRIC '
  }
  const events = [];
  for (const line of raw.split('\n')) {
    const idx = line.indexOf('VVMETRIC ');
    if (idx === -1) continue;
    try {
      events.push(JSON.parse(line.slice(idx + 'VVMETRIC '.length)));
    } catch {
      // dòng hỏng — bỏ qua
    }
  }
  return events;
}

const events = files.flatMap(parseFile).sort((a, b) => a.ts - b.ts);
console.log(`Đã đọc ${events.length} event từ ${files.length} file.`);

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function summarize(label, values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    label,
    count: sorted.length,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    max: sorted.length ? sorted[sorted.length - 1] : NaN,
  };
}

// Gom theo captureId: capture_start → api_request → api_response → tts_start
const byCapture = new Map();
for (const e of events) {
  if (typeof e.captureId !== 'number') continue;
  if (!byCapture.has(e.captureId)) byCapture.set(e.captureId, {});
  const slot = byCapture.get(e.captureId);
  slot[e.event] = slot[e.event] ?? e; // giữ event đầu tiên của mỗi loại
}

const tCapture = []; // capture_start → api_request (chụp + resize + base64)
const tApi = []; // api_request → api_response (mạng + Gemini)
const tTotal = []; // capture_start → tts_start (bấm tới lúc bắt đầu nghe)
const mockCount = { mock: 0, real: 0 };
const captureRows = [];

for (const [captureId, s] of [...byCapture.entries()].sort((a, b) => a[0] - b[0])) {
  const start = s.capture_start;
  const req = s.api_request;
  const res = s.api_response;
  const tts = s.tts_start;
  if (res?.mock) mockCount.mock += 1;
  else if (res) mockCount.real += 1;
  const row = {
    captureId,
    trigger: start?.trigger ?? '',
    kind: req?.kind ?? '',
    ok: res?.ok ?? '',
    mock: res?.mock ?? false,
    captureMs: start && req ? req.ts - start.ts : '',
    apiMs: req && res ? res.ts - req.ts : '',
    totalMs: start && tts ? tts.ts - start.ts : '',
  };
  captureRows.push(row);
  if (res?.mock) continue; // số liệu mock không được tính vào thống kê
  if (typeof row.captureMs === 'number') tCapture.push(row.captureMs);
  if (typeof row.apiMs === 'number') tApi.push(row.apiMs);
  if (typeof row.totalMs === 'number') tTotal.push(row.totalMs);
}

// Vật cản: fps từ khoảng cách obstacle_frame, detectMs, đếm alert theo mức
const frames = events.filter((e) => e.event === 'obstacle_frame');
const alerts = events.filter((e) => e.event === 'obstacle_alert');
const detectMs = frames.map((f) => f.detectMs).filter((v) => typeof v === 'number');
const frameGaps = [];
for (let i = 1; i < frames.length; i += 1) {
  const gap = frames[i].ts - frames[i - 1].ts;
  if (gap > 0 && gap < 10_000) frameGaps.push(gap); // bỏ khoảng nghỉ giữa các phiên
}
const avgGap = frameGaps.length ? frameGaps.reduce((a, b) => a + b, 0) / frameGaps.length : NaN;
const alertBySeverity = {};
for (const a of alerts) alertBySeverity[a.severity] = (alertBySeverity[a.severity] ?? 0) + 1;

// In tóm tắt
const latencyRows = [
  summarize('Chụp + xử lý ảnh (capture→request)', tCapture),
  summarize('Gemini (request→response)', tApi),
  summarize('Tổng (capture→bắt đầu đọc)', tTotal),
  summarize('ML Kit detect (ms/khung)', detectMs),
];
console.log('\n== Độ trễ (ms, đã loại mock) ==');
console.table(latencyRows);
console.log(`Mock/real responses: ${mockCount.mock}/${mockCount.real}` + (mockCount.mock > 0 ? '  ⚠ CÓ MOCK TRONG LOG' : ''));
console.log(`\n== Vật cản ==\nframes: ${frames.length}, fps trung bình: ${avgGap ? (1000 / avgGap).toFixed(2) : 'n/a'}, alerts:`, alertBySeverity);

const qaQuestions = events.filter((e) => e.event === 'qa_question').length;
const qaAnswers = events.filter((e) => e.event === 'qa_answer').length;
console.log(`\n== Hỏi đáp ==\ncâu hỏi: ${qaQuestions}, câu trả lời: ${qaAnswers}`);

// CSV chi tiết từng lần chụp + CSV tóm tắt
mkdirSync(OUT_DIR, { recursive: true });
const detailCsv = ['captureId,trigger,kind,ok,mock,captureMs,apiMs,totalMs']
  .concat(captureRows.map((r) => [r.captureId, r.trigger, r.kind, r.ok, r.mock, r.captureMs, r.apiMs, r.totalMs].join(',')))
  .join('\n');
writeFileSync(join(OUT_DIR, 'metrics-captures.csv'), detailCsv);
const summaryCsv = ['metric,count,p50,p90,max']
  .concat(latencyRows.map((r) => [r.label, r.count, r.p50, r.p90, r.max].join(',')))
  .join('\n');
writeFileSync(join(OUT_DIR, 'metrics-summary.csv'), summaryCsv);
console.log(`\nĐã ghi: eval/results/metrics-captures.csv, eval/results/metrics-summary.csv`);
