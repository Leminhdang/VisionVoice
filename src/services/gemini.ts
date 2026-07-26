/**
 * Gemini service — mô tả ảnh và hỏi đáp qua Firebase AI Logic (@react-native-firebase/ai).
 * Không bao giờ trả văn bản lỗi như một caption: mọi lỗi được ném ra dưới dạng GeminiError
 * để tầng UI tự ánh xạ sang ERRORS[kind] trong strings.ts.
 */

import { getAI, getGenerativeModel, GoogleAIBackend } from '@react-native-firebase/ai';
import type { AI, ChatSession, GenerativeModel, Part } from '@react-native-firebase/ai';
import { getApp } from '@react-native-firebase/app';

import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  MOCK_DELAY_MS,
  MOCK_DESCRIPTION,
  MOCK_MODE,
  MOCK_QA_ANSWER,
} from '../constants/config';
import { DESCRIBE_PROMPT, GEMINI_SYSTEM_INSTRUCTION } from '../constants/strings';
import { getAppCheckInstance } from './firebase';
import type { PreparedImage } from './imagePipeline';
import { logMetric } from './metrics';

const IMAGE_MIME_TYPE = 'image/jpeg';

export type GeminiErrorKind = 'network' | 'blocked' | 'quota' | 'unknown';

export class GeminiError extends Error {
  readonly kind: GeminiErrorKind;

  constructor(kind: GeminiErrorKind, message: string) {
    super(message);
    this.name = 'GeminiError';
    this.kind = kind;
  }
}

export interface QASession {
  ask(question: string, captureId?: number): Promise<string>;
  dispose(): void;
}

// Lazy singleton — mutation có chủ đích: cache module-level, chỉ khởi tạo một lần.
let aiInstance: AI | null = null;
const modelCache = new Map<string, GenerativeModel>();

function getAiInstance(): AI {
  if (aiInstance) {
    return aiInstance;
  }
  // AIOptions.appCheck (23.8.8) nhận AppCheck | null nên truyền thẳng instance từ firebase.ts.
  aiInstance = getAI(getApp(), {
    backend: new GoogleAIBackend(),
    appCheck: getAppCheckInstance(),
  });
  return aiInstance;
}

function getModel(modelName: string): GenerativeModel {
  const cached = modelCache.get(modelName);
  if (cached) {
    return cached;
  }
  const created = getGenerativeModel(getAiInstance(), {
    model: modelName,
    systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
  });
  modelCache.set(modelName, created);
  return created;
}

function buildImagePart(image: PreparedImage): Part {
  return { inlineData: { mimeType: IMAGE_MIME_TYPE, data: image.base64 } };
}

function readErrorText(err: unknown): string {
  if (err instanceof Error) {
    const code = 'code' in err && typeof err.code === 'string' ? err.code : '';
    return `${code} ${err.message}`;
  }
  return String(err);
}

function mapErrorKind(err: unknown): GeminiErrorKind {
  const text = readErrorText(err).toLowerCase();
  if (text.includes('network') || text.includes('fetch') || text.includes('timeout')) {
    return 'network';
  }
  if (text.includes('safety') || text.includes('blocked')) {
    return 'blocked';
  }
  if (text.includes('429') || text.includes('quota') || text.includes('resource_exhausted')) {
    return 'quota';
  }
  return 'unknown';
}

function toGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) {
    return err;
  }
  return new GeminiError(mapErrorKind(err), readErrorText(err));
}

function shouldRetryWithFallback(err: unknown): boolean {
  if (err instanceof GeminiError) {
    return false;
  }
  const text = readErrorText(err).toLowerCase();
  return mapErrorKind(err) === 'quota' || text.includes('not found') || text.includes('404');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logRequest(captureId: number | undefined, kind: 'describe' | 'qa'): void {
  if (captureId === undefined) {
    return;
  }
  logMetric({ event: 'api_request', captureId, kind });
}

function logResponse(
  captureId: number | undefined,
  outcome: { ok: boolean; errorCode?: string; mock?: boolean },
): void {
  if (captureId === undefined) {
    return;
  }
  logMetric({ event: 'api_response', captureId, ...outcome });
}

function extractText(response: { text: () => string }): string {
  const text = response.text().trim();
  if (!text) {
    throw new GeminiError('unknown', 'Mô hình không trả về nội dung.');
  }
  return text;
}

async function requestDescription(modelName: string, image: PreparedImage): Promise<string> {
  const result = await getModel(modelName).generateContent([
    buildImagePart(image),
    { text: DESCRIBE_PROMPT },
  ]);
  return extractText(result.response);
}

async function describeWithFallback(image: PreparedImage): Promise<string> {
  try {
    return await requestDescription(GEMINI_MODEL, image);
  } catch (err) {
    if (!shouldRetryWithFallback(err)) {
      throw toGeminiError(err);
    }
    try {
      return await requestDescription(GEMINI_FALLBACK_MODEL, image);
    } catch (fallbackErr) {
      throw toGeminiError(fallbackErr);
    }
  }
}

/**
 * Mô tả một ảnh đã chuẩn bị. Ném GeminiError khi thất bại — không bao giờ
 * trả văn bản lỗi như caption. Truyền captureId để ghi metric api_request/api_response.
 */
export async function describeImage(image: PreparedImage, captureId?: number): Promise<string> {
  logRequest(captureId, 'describe');
  if (MOCK_MODE) {
    await delay(MOCK_DELAY_MS);
    logResponse(captureId, { ok: true, mock: true });
    return MOCK_DESCRIPTION;
  }
  try {
    const caption = await describeWithFallback(image);
    logResponse(captureId, { ok: true });
    return caption;
  } catch (err) {
    const geminiError = toGeminiError(err);
    logResponse(captureId, { ok: false, errorCode: geminiError.kind });
    throw geminiError;
  }
}

function createMockQASession(): QASession {
  return {
    async ask(_question: string, captureId?: number): Promise<string> {
      logRequest(captureId, 'qa');
      await delay(MOCK_DELAY_MS);
      logResponse(captureId, { ok: true, mock: true });
      return MOCK_QA_ANSWER;
    },
    dispose(): void {
      // Mock: không có tài nguyên cần giải phóng.
    },
  };
}

/**
 * Tạo phiên hỏi đáp nhiều lượt về một ảnh. Lượt hỏi đầu gửi kèm ảnh,
 * các lượt sau chỉ gửi câu hỏi. dispose() bỏ tham chiếu phiên chat.
 */
export function createQASession(image: PreparedImage): QASession {
  if (MOCK_MODE) {
    return createMockQASession();
  }

  let chat: ChatSession | null = getModel(GEMINI_MODEL).startChat();
  let isFirstTurn = true;

  return {
    async ask(question: string, captureId?: number): Promise<string> {
      if (!chat) {
        throw new GeminiError('unknown', 'Phiên hỏi đáp đã kết thúc.');
      }
      logRequest(captureId, 'qa');
      const parts: Part[] = isFirstTurn
        ? [buildImagePart(image), { text: question }]
        : [{ text: question }];
      try {
        const result = await chat.sendMessage(parts);
        const answer = extractText(result.response);
        isFirstTurn = false;
        logResponse(captureId, { ok: true });
        return answer;
      } catch (err) {
        const geminiError = toGeminiError(err);
        logResponse(captureId, { ok: false, errorCode: geminiError.kind });
        throw geminiError;
      }
    },
    dispose(): void {
      chat = null;
    },
  };
}
