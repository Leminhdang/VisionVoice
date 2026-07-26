/**
 * Firebase bootstrap — chỉ lo App Check.
 * App RNFB tự khởi tạo từ cấu hình native (google-services.json / GoogleService-Info.plist),
 * nên ở đây chỉ cần kích hoạt App Check rồi giữ lại instance cho gemini.ts dùng với getAI.
 */

import { getApp } from '@react-native-firebase/app';
import appCheck, { initializeAppCheck } from '@react-native-firebase/app-check';
import type { FirebaseAppCheckTypes } from '@react-native-firebase/app-check';

type AppCheck = FirebaseAppCheckTypes.Module;

let hasInitialized = false;
let appCheckInstance: AppCheck | null = null;

/**
 * Khởi tạo Firebase App Check. Idempotent — gọi lại sẽ không làm gì.
 * Nếu App Check khởi tạo thất bại, app vẫn phải boot bình thường.
 */
export async function initFirebase(): Promise<void> {
  if (hasInitialized) {
    return;
  }
  hasInitialized = true;
  try {
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      },
    });
    // Không hardcode debug token: provider 'debug' sẽ in token ra native log
    // (adb logcat / Xcode console) ở lần chạy đầu — đăng ký token đó trong
    // Firebase console → App Check → Debug tokens.
    appCheckInstance = await initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('Lỗi khi khởi tạo Firebase App Check:', e);
  }
}

/**
 * Trả về instance App Check đã khởi tạo (null nếu chưa init hoặc init thất bại).
 */
export function getAppCheckInstance(): AppCheck | null {
  return appCheckInstance;
}
