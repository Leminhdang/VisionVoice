import axios, { AxiosError } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS, ERROR_MESSAGE } from '../constants/config';

// ============================================================
// Types
// ============================================================

export interface AnalyzeImageResponse {
  description: string;
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
  console.log('[API] →', config.method?.toUpperCase(), config.url);
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

// ============================================================
// API functions
// ============================================================

/**
 * Gửi ảnh lên backend để phân tích.
 * @param imageUri - file URI cục bộ từ expo-camera
 * @returns description tiếng Việt
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

    const response = await apiClient.post<AnalyzeImageResponse>(
      '/analyze-image',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    const description = response.data?.description?.trim();
    if (!description) {
      throw new Error('Backend trả về mô tả rỗng.');
    }

    console.log('[API] description:', description);
    return description;
  } catch (err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    const serverMsg = axiosErr.response?.data?.message;
    console.error('[API] analyzeImage failed:', serverMsg ?? axiosErr.message);
    return ERROR_MESSAGE;
  }
}
