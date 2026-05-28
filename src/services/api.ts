import axios, { AxiosError } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS, ERROR_MESSAGE } from '../constants/config';

// ============================================================
// Types
// ============================================================

export interface AnalyzeImageResponse {
  description?: string;
  caption?: string;
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
 * Gửi ảnh lên backend để gen caption.
 * POST /caption với formData chứa field "image".
 * @param imageUri - file URI cục bộ từ expo-camera hoặc expo-image-picker
 * @returns caption tiếng Việt
 */
export async function analyzeImage(imageUri: string): Promise<string> {
  try {
    const formData = new FormData();
    // React Native FormData chấp nhận object dạng { uri, name, type }
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    console.log('[API] POST /caption...');
    const response = await apiClient.post<AnalyzeImageResponse>(
      '/caption',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

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
