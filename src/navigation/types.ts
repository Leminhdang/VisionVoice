import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PreparedImage } from '../services/imagePipeline';

export type RootStackParamList = {
  HomeCamera: undefined;
  QASession: { image: PreparedImage; caption: string };
  ObstacleMode: undefined;
  Settings: undefined;
};

export type HomeCameraScreenProps = NativeStackScreenProps<RootStackParamList, 'HomeCamera'>;
export type QASessionScreenProps = NativeStackScreenProps<RootStackParamList, 'QASession'>;
export type ObstacleModeScreenProps = NativeStackScreenProps<RootStackParamList, 'ObstacleMode'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
