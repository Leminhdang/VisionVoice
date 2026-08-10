import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { initFirebase } from './src/services/firebase';
import { initTfliteModel } from './src/services/tfliteDetector';
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
    // Singleton trọn vòng đời app — tts.ts, firebase.ts và tfliteDetector.ts
    // ghi rõ chỉ gọi một lần từ App.tsx và không có teardown.
    initTts();
    void initFirebase();
    void initTfliteModel();
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
