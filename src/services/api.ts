import axios, { AxiosError } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS, ERROR_MESSAGE } from '../constants/config';

// ============================================================
// Types
// ============================================================

export interface AnalyzeImageResponse {
  success?: boolean;
  description?: string;
  caption?: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

// ============================================================
// Axios instance
// ============================================================

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
});

// Request logger (debug only)
apiClient.interceptors.request.use((config) => {
  console.log('[API] →', config.method?.toUpperCase(), config.baseURL + (config.url || ''));
  return config;
});

// Response logger (debug only)
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API] ← status:', response.status);
    return response;
  },
  (error: AxiosError) => {
    console.error('[API] ✗ error:', error.message);
    return Promise.reject(error);
  },
);

/**
 * Cập nhật baseURL của API client lúc chạy app (ví dụ khi đổi URL Colab/Ngrok)
 */
export function updateApiBaseUrl(newUrl: string) {
  let cleanUrl = newUrl.trim();
  // Tự động thêm http:// nếu thiếu
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  apiClient.defaults.baseURL = cleanUrl;
  console.log('[API] Base URL updated to:', cleanUrl);
}

// ============================================================
// API functions
// ============================================================

/**
 * Gửi ảnh lên backend để phân tích.
 * Hỗ trợ thử endpoint /caption trước, nếu 404 sẽ fallback sang /api/analyze.
 * Nhận diện cả key 'caption' hoặc 'description' trả về từ Colab backend.
 * @param imageUri - file URI cục bộ từ expo-camera hoặc expo-image-picker
 * @returns description/caption tiếng Việt
 */
export async function analyzeImage(imageUri: string): Promise<string> {
  try {
    const filename = imageUri.split('/').pop() ?? 'photo.jpg';
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const formData = new FormData();
    // React Native FormData chấp nhận object dạng { uri, name, type }
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    let response;
    try {
      console.log('[API] Attempting to call /caption...');
      response = await apiClient.post<AnalyzeImageResponse>(
        '/caption',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        console.log('[API] /caption returned 404, falling back to /api/analyze...');
        response = await apiClient.post<AnalyzeImageResponse>(
          '/api/analyze',
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
      } else {
        throw err;
      }
    }

    const data = response.data;
    const description = (data?.caption || data?.description || '').trim();
    
    if (!description) {
      throw new Error('Backend trả về mô tả rỗng.');
    }

    console.log('[API] Generated caption:', description);
    return description;
  } catch (err) {
    const axiosErr = err as AxiosError<{ error?: string; details?: string }>;
    const serverMsg = axiosErr.response?.data?.error;
    const serverDetails = axiosErr.response?.data?.details;
    
    console.error('[API] analyzeImage failed:', serverMsg || axiosErr.message, serverDetails ? `(Chi tiết: ${serverDetails})` : '');
    return ERROR_MESSAGE;
  }
}
