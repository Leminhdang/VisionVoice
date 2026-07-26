import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import HomeCameraScreen from '../screens/HomeCameraScreen';
import ObstacleModeScreen from '../screens/ObstacleModeScreen';
import QASessionScreen from '../screens/QASessionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SCREEN_OPTIONS: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'none',
  contentStyle: { backgroundColor: colors.bg },
};

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="HomeCamera" screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="HomeCamera" component={HomeCameraScreen} />
      <Stack.Screen name="QASession" component={QASessionScreen} />
      <Stack.Screen name="ObstacleMode" component={ObstacleModeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
