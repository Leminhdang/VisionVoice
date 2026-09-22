/**
 * Firebase bootstrap — chỉ lo App Check.
 * App RNFB tự khởi tạo từ cấu hình native (google-services.json / GoogleService-Info.plist),
 * nên ở đây chỉ cần kích hoạt App Check rồi giữ lại instance cho gemini.ts dùng với getAI.
 */

import { getApp } from '@react-native-firebase/app';
import appCheck, { getToken, initializeAppCheck } from '@react-native-firebase/app-check';
import type { FirebaseAppCheckTypes } from '@react-native-firebase/app-check';

import { APP_CHECK_DEBUG_TOKEN } from '../constants/config';

type AppCheck = FirebaseAppCheckTypes.Module;

let appCheckInstance: AppCheck | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Khởi tạo Firebase App Check. Idempotent — gọi lại sẽ không làm gì.
 * Nếu App Check khởi tạo thất bại, app vẫn phải boot bình thường.
 */
export function initFirebase(): Promise<void> {
  if (initPromise !== null) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
      const debugToken = APP_CHECK_DEBUG_TOKEN || undefined;
      const useDebugProvider = __DEV__ || debugToken !== undefined;
      provider.configure({
        android: useDebugProvider
          ? { provider: 'debug', debugToken }
          : { provider: 'playIntegrity' },
        apple: useDebugProvider
          ? { provider: 'debug', debugToken }
          : { provider: 'appAttestWithDeviceCheckFallback' },
      });
      appCheckInstance = await initializeAppCheck(getApp(), {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      try {
        await getToken(appCheckInstance);
      } catch (e) {
        console.warn('Lỗi khi làm nóng Firebase App Check:', e);
      }
    } catch (e) {
      console.warn('Lỗi khi khởi tạo Firebase App Check:', e);
    }
  })();
  return initPromise;
}

/**
 * Trả về instance App Check đã khởi tạo (null nếu chưa init hoặc init thất bại).
 */
export function getAppCheckInstance(): AppCheck | null {
  return appCheckInstance;
}
