import * as Haptics from 'expo-haptics';
import { createAudioPlayer, AudioPlayer, AudioSource } from 'expo-audio';

export type FeedbackSeverity = 'safe' | 'warning' | 'danger';

const DANGER_HAPTIC_GAP_MS = 150;

type SoundName = 'shutter' | 'listenStart' | 'listenEnd' | 'danger';

const SOUND_SOURCES: Record<SoundName, AudioSource> = {
  shutter: require('../../assets/sounds/shutter.wav'),
  listenStart: require('../../assets/sounds/listen-start.wav'),
  listenEnd: require('../../assets/sounds/listen-end.wav'),
  danger: require('../../assets/sounds/danger.wav'),
};

const playerCache = new Map<SoundName, AudioPlayer>();

function getPlayer(name: SoundName): AudioPlayer {
  const cached = playerCache.get(name);
  if (cached) {
    return cached;
  }
  const player = createAudioPlayer(SOUND_SOURCES[name]);
  playerCache.set(name, player);
  return player;
}

async function playSound(name: SoundName): Promise<void> {
  try {
    const player = getPlayer(name);
    await player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn('Lỗi khi phát âm thanh:', e);
  }
}

async function safeHaptic(trigger: () => Promise<void>): Promise<void> {
  try {
    await trigger();
  } catch {
    // Haptics không khả dụng trên một số thiết bị — bỏ qua.
  }
}

export async function hapticCapture(): Promise<void> {
  await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export async function hapticNavigate(): Promise<void> {
  await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export async function hapticStop(): Promise<void> {
  await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export async function notifySuccess(): Promise<void> {
  await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export async function notifyError(): Promise<void> {
  await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export async function notifyWarning(): Promise<void> {
  await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticForSeverity(severity: FeedbackSeverity): void {
  if (severity === 'safe') {
    return;
  }
  if (severity === 'warning') {
    void safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    return;
  }
  void safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  setTimeout(() => {
    void safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  }, DANGER_HAPTIC_GAP_MS);
}

export async function playShutter(): Promise<void> {
  await playSound('shutter');
}

export async function playListenStart(): Promise<void> {
  await playSound('listenStart');
}

export async function playListenEnd(): Promise<void> {
  await playSound('listenEnd');
}

export async function playDanger(): Promise<void> {
  await playSound('danger');
}
