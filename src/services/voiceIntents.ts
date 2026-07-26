import { KEYWORDS } from '../constants/strings';

export type VoiceIntent =
  | 'capture'
  | 'question'
  | 'repeat'
  | 'back'
  | 'obstacle'
  | 'stop'
  | 'settings'
  | 'unknown';

type MatchableIntent = Exclude<VoiceIntent, 'unknown'>;

const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const D_STROKE_REGEX = /[đĐ]/g;
const WHITESPACE_REGEX = /\s+/g;

/**
 * Chuẩn hoá tiếng Việt: bỏ dấu, đ→d, lowercase, gộp khoảng trắng.
 * ASR trả về cả biến thể có dấu lẫn không dấu nên mọi so khớp
 * đều thực hiện trên chuỗi đã chuẩn hoá.
 */
export function normalizeVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING_MARKS_REGEX, '')
    .replace(D_STROKE_REGEX, 'd')
    .toLowerCase()
    .trim()
    .replace(WHITESPACE_REGEX, ' ');
}

/**
 * Thứ tự ưu tiên khi một câu chứa nhiều từ khoá.
 * 'capture' đứng cuối vì "chụp" xuất hiện trong nhiều câu
 * (ví dụ "dừng chụp" phải ra 'stop', không phải 'capture').
 */
const INTENT_PRIORITY: readonly MatchableIntent[] = [
  'stop',
  'back',
  'question',
  'repeat',
  'obstacle',
  'settings',
  'capture',
];

const NORMALIZED_KEYWORDS: ReadonlyMap<MatchableIntent, readonly string[]> = new Map(
  INTENT_PRIORITY.map((intent) => [
    intent,
    KEYWORDS[intent].map(normalizeVietnamese).filter((keyword) => keyword.length > 0),
  ]),
);

/**
 * So khớp theo ranh giới từ, không dùng substring trần:
 * "thời tiết" chuẩn hoá thành "thoi tiet" chứa chuỗi con "hoi"
 * nên includes() trần sẽ match nhầm intent 'question'.
 */
function containsKeyword(normalizedTranscript: string, keyword: string): boolean {
  return ` ${normalizedTranscript} `.includes(` ${keyword} `);
}

export function parseIntent(transcript: string): VoiceIntent {
  const normalized = normalizeVietnamese(transcript);
  if (normalized === '') {
    return 'unknown';
  }

  for (const intent of INTENT_PRIORITY) {
    const keywords = NORMALIZED_KEYWORDS.get(intent) ?? [];
    if (keywords.some((keyword) => containsKeyword(normalized, keyword))) {
      return intent;
    }
  }

  return 'unknown';
}
