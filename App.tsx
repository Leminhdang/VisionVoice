import {
  useObjectDetectionModels,
  useObjectDetectionProvider,
} from '@infinitered/react-native-mlkit-object-detection';
import type { RNMLKitObjectDetectorOptions } from '@infinitered/react-native-mlkit-object-detection';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import { initFirebase } from './src/services/firebase';
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

// Tham chiếu module-level ổn định — useObjectDetectionModels đưa options vào
// deps của useEffect, nên object mới mỗi render sẽ khiến model nạp lại liên tục.
const DEFAULT_DETECTOR_OPTIONS: RNMLKitObjectDetectorOptions = {
  shouldEnableClassification: true,
  shouldEnableMultipleObjects: true,
  detectorMode: 'singleImage',
};

function DetectionRoot() {
  const models = useObjectDetectionModels({
    loadDefaultModel: true,
    defaultModelOptions: DEFAULT_DETECTOR_OPTIONS,
  });
  const { ObjectDetectionProvider } = useObjectDetectionProvider(models);

  return (
    <ObjectDetectionProvider>
      <NavigationContainer theme={NAV_THEME}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </ObjectDetectionProvider>
  );
}

export default function App() {
  useEffect(() => {
    // Singleton trọn vòng đời app — tts.ts và firebase.ts ghi rõ chỉ gọi một
    // lần từ App.tsx và không có teardown (subscription giữ nguyên chủ đích).
    initTts();
    void initFirebase();
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <DetectionRoot />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
