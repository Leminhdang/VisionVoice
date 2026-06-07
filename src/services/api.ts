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
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

export function updateApiBaseUrl(newUrl: string) {
  let cleanUrl = newUrl.trim();
  if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  apiClient.defaults.baseURL = cleanUrl;
}

export async function analyzeImage(imageUri: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

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
    return description;
  } catch (err) {
    return ERROR_MESSAGE;
  }
}
