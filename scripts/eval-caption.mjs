#!/usr/bin/env node
/**
 * Sinh caption Gemini cho bộ ảnh đánh giá — chạy offline từ máy tính,
 * dùng CÙNG model và CÙNG system instruction với app (đọc thẳng từ
 * src/constants/config.ts và src/constants/strings.ts để không lệch).
 *
 * Chuẩn bị:
 *   1. eval/manifest.json  — [{ "id": 1, "file": "eval/images/001.jpg", "category": "cho" }, ...]
 *   2. export GEMINI_API_KEY=<key lấy từ Google AI Studio>
 *   3. npm i -g @google/genai  (hoặc npx --package=@google/genai)
 *
 * Cách dùng:  GEMINI_API_KEY=... node scripts/eval-caption.mjs
 * Đầu ra:     eval/results/gemini-captions.json (ghi tăng dần, chạy lại tự bỏ qua ảnh đã có)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'eval', 'manifest.json');
const OUT = join(ROOT, 'eval', 'results', 'gemini-captions.json');
const SLEEP_MS = 8_000; // quota gói miễn phí — không dồn request
const RETRY_BACKOFF_MS = 60_000;

// Đọc model id + prompt từ đúng source của app (regex trên file TS, fail to nếu không thấy)
function extractConst(file, name) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const m = src.match(new RegExp(`${name}\\s*=\\s*(?:'([^']*)'|\`([\\s\\S]*?)\`)`));
  if (!m) throw new Error(`Không tìm thấy ${name} trong ${file} — kiểm tra lại tên hằng.`);
  return m[1] ?? m[2];
}
const GEMINI_MODEL = extractConst('src/constants/config.ts', 'GEMINI_MODEL');
const SYSTEM_INSTRUCTION = extractConst('src/constants/strings.ts', 'GEMINI_SYSTEM_INSTRUCTION');
const DESCRIBE_PROMPT = extractConst('src/constants/strings.ts', 'DESCRIBE_PROMPT');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Thiếu GEMINI_API_KEY. Chạy: GEMINI_API_KEY=... node scripts/eval-caption.mjs');
  process.exit(1);
}

const { GoogleGenAI } = await import('@google/genai').catch(() => {
  console.error('Thiếu package @google/genai. Cài: npm install @google/genai (trong thư mục scripts hoặc global).');
  process.exit(1);
});
const ai = new GoogleGenAI({ apiKey });

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
mkdirSync(dirname(OUT), { recursive: true });
const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const done = new Set(results.map((r) => r.id));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function captionOne(entry) {
  const imageBytes = readFileSync(join(ROOT, entry.file));
  const t0 = Date.now();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    config: { systemInstruction: SYSTEM_INSTRUCTION },
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: imageBytes.toString('base64') } },
      { text: DESCRIBE_PROMPT },
    ],
  });
  return { id: entry.id, file: entry.file, category: entry.category ?? '', caption: (response.text ?? '').trim(), latencyMs: Date.now() - t0 };
}

console.log(`Model: ${GEMINI_MODEL} — ${manifest.length} ảnh, đã có ${done.size} kết quả.`);
for (const entry of manifest) {
  if (done.has(entry.id)) continue;
  let result;
  try {
    result = await captionOne(entry);
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('429') || msg.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
      console.warn(`429 tại ảnh ${entry.id} — nghỉ ${RETRY_BACKOFF_MS / 1000}s rồi thử lại một lần...`);
      await sleep(RETRY_BACKOFF_MS);
      result = await captionOne(entry); // lần 2 lỗi thì để script chết — chạy lại sẽ resume
    } else {
      throw err;
    }
  }
  results.push(result);
  writeFileSync(OUT, JSON.stringify(results, null, 2)); // ghi tăng dần — kill giữa chừng không mất
  console.log(`[${results.length}/${manifest.length}] id=${result.id} ${result.latencyMs}ms: ${result.caption.slice(0, 80)}...`);
  await sleep(SLEEP_MS);
}
console.log(`Xong. Kết quả: ${OUT}`);
