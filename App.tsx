import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
// TẠM TẮT APP CHECK để gọi Gemini khi test/build — BẬT LẠI trước khi nộp.
// import { initFirebase } from './src/services/firebase';
import { loadObstacleModel } from './src/services/obstacleModel';
import { initTts } from './src/services/tts';
import { SettingsProvider } from './src/state/SettingsContext';
import { colors } from './src/theme/colors';

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.textPrimary,
    border: colors.line,
  },
};

export default function App() {
  useEffect(() => {
    // Singleton trọn vòng đời app — tts.ts và firebase.ts
    // ghi rõ chỉ gọi một lần từ App.tsx và không có teardown.
    initTts();
    // TẠM TẮT APP CHECK để gọi Gemini khi test/build — BẬT LẠI trước khi nộp.
    // void initFirebase();
    // Chép + nạp model dò vật cản ngay từ đầu, chạy nền: vào chế độ dò là dùng
    // được luôn. CỐ Ý KHÔNG nói gì khi hỏng — lúc này usePermissionBootstrap
    // đang đọc chuỗi xin quyền, chen vào là nhiễu, mà người dùng cũng chưa vào
    // chế độ dò. Hook trong useObstacleScanner sẽ thử lại và nói lỗi ra đúng
    // lúc người dùng thật sự cần.
    loadObstacleModel().catch((err: unknown) => {
      console.warn('Lỗi khi chuẩn bị model dò vật cản:', err);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <NavigationContainer theme={NAV_THEME}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
