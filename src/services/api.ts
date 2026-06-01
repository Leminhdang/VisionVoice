import axios, { AxiosError } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS, ERROR_MESSAGE } from '../constants/config';

export interface AnalyzeImageResponse {
  description?: string;
  caption?: string;
}




const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  console.log('[API] →', config.method?.toUpperCase(), config.baseURL + (config.url || ''));
  return config;
});

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

export function updateApiBaseUrl(newUrl: string) {
  let cleanUrl = newUrl.trim();
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  apiClient.defaults.baseURL = cleanUrl;
  console.log('[API] Base URL updated to:', cleanUrl);
}

export async function analyzeImage(imageUri: string): Promise<string> {
  try {
    const formData = new FormData();
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
