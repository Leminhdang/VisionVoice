import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { VolumeManager } from 'react-native-volume-manager';
import * as ScreenCapture from 'expo-screen-capture';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { analyzeImage } from '../services/api';
import { useDebounceCallback } from '../hooks/useDebounceCallback';
import {
  CAPTURE_FEEDBACK_PHRASE,
  CAPTURE_KEYWORDS,
  MOCK_DESCRIPTION,
  MOCK_MODE,
  SPEECH_RECOGNITION_LOCALE,
  TTS_LOCALE,
} from '../constants/config';

// ============================================================
// Types
// ============================================================
type CaptureState = 'idle' | 'capturing' | 'analyzing' | 'speaking';

// ============================================================
// CameraScreen
// ============================================================

export default function CameraScreen() {
  // --- Permissions ---
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // --- Refs ---
  const cameraRef = useRef<CameraView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // --- State ---
  const [facing] = useState<CameraType>('back');
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [statusText, setStatusText] = useState('');
  const [isListening, setIsListening] = useState(false);
  /**
   * true khi tất cả permissions đã được cấp và camera sẵn sàng.
   */
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [waitingForVoicePermission, setWaitingForVoicePermission] = useState(false);

  // ============================================================
  // Core: Chụp ảnh → gửi API → đọc kết quả
  // ============================================================

  const captureAndAnalyze = useCallback(async () => {
    if (captureState !== 'idle') {
      console.log('[Capture] Blocked – state:', captureState);
      return;
    }
    if (!cameraRef.current) return;

    try {
      // 1. Rung để phản hồi xúc giác
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // 2. Phát âm thanh chụp (shutter)
      playCameraSound();

      // 3. Chụp ảnh
      setCaptureState('capturing');
      setStatusText('Đang chụp ảnh...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipMetadata: true,
      });

      if (!photo?.uri) throw new Error('Không lấy được URI ảnh.');
      console.log('[Capture] photo URI:', photo.uri);

      // 4. Đọc thông báo ngay lập tức (người dùng không phải chờ im lặng)
      Speech.speak(CAPTURE_FEEDBACK_PHRASE, { language: TTS_LOCALE });

      // 5. Gửi lên backend (hoặc mock)
      setCaptureState('analyzing');
      setStatusText('Đang phân tích ảnh...');

      let description: string;
      if (MOCK_MODE) {
        // Giả lập delay network 1.5 giây → trả mô tả mẫu
        console.log('[Mock] MOCK_MODE=true – skipping real API call.');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        description = MOCK_DESCRIPTION;
      } else {
        description = await analyzeImage(photo.uri);
      }

      // 5. Đọc kết quả
      setCaptureState('speaking');
      setStatusText('Đang đọc kết quả...');

      await Speech.speak(description, {
        language: TTS_LOCALE,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          setCaptureState('idle');
          setStatusText('');
        },
        onError: () => {
          setCaptureState('idle');
          setStatusText('');
        },
      });
    } catch (err) {
      console.error('[CameraScreen] captureAndAnalyze error:', err);
      setCaptureState('idle');
      setStatusText('');

      Speech.speak('Đã xảy ra lỗi. Vui lòng thử lại.', { language: TTS_LOCALE });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [captureState]);

  // Debounce để tránh trigger nhiều lần liên tiếp (volume button / voice)
  const debouncedCapture = useDebounceCallback(captureAndAnalyze as (...args: unknown[]) => void);

  // ============================================================
  // Shutter sound
  // ============================================================

  const playCameraSound = useCallback(async () => {
    try {
      // Tải và phát âm thanh chụp (file đặt trong assets/sounds/shutter.mp3)
      const { sound } = await Audio.Sound.createAsync(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../assets/sounds/shutter.mp3'),
        { shouldPlay: true, volume: 0.6 },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      // File âm thanh chưa có – bỏ qua, không crash
      console.warn('[Sound] shutter.mp3 not found, skipping.', e);
    }
  }, []);

  // ============================================================
  // Volume button listener
  // ============================================================

  useEffect(() => {
    // 1. Volume button listener
    const volumeSubscription = VolumeManager.addVolumeListener((result) => {
      console.log('[Volume] changed:', result.volume);
      debouncedCapture();
    });

    // 2. Screenshot (Combo Power + Volume Down) listener
    const screenshotSubscription = ScreenCapture.addScreenshotListener(() => {
      console.log('[Screenshot] Combo detected!');
      debouncedCapture();
    });

    return () => {
      volumeSubscription.remove();
      screenshotSubscription.remove();
    };
  }, [debouncedCapture]);

  // ============================================================
  // Speech recognition (expo-speech-recognition)
  // ============================================================

  // Khởi tạo speech recognition permissions và bắt đầu lắng nghe
  const startVoiceListening = useCallback(async () => {
    const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permResult.granted) {
      console.warn('[Voice] Microphone permission denied.');
      return;
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: SPEECH_RECOGNITION_LOCALE,
        interimResults: true,
        continuous: true,
      });
      setIsListening(true);
      console.log('[Voice] Started listening.');
    } catch (e) {
      console.error('[Voice] Failed to start:', e);
    }
  }, []);

  const stopVoiceListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      console.log('[Voice] Stopped.');
    } catch (e) {
      console.warn('[Voice] Stop error:', e);
    }
  }, []);

  // Lắng nghe kết quả nhận dạng
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.toLowerCase().trim() ?? '';
    if (!transcript) return;

    console.log('[Voice] transcript:', transcript);

    // Xử lý xác nhận quyền bằng giọng nói
    if (waitingForVoicePermission) {
      if (transcript.includes('đồng ý') || transcript.includes('chấp nhận') || transcript.includes('ok')) {
        console.log('[Permission] Voice agreement detected!');
        setWaitingForVoicePermission(false);
        requestCameraPermission();
      }
      return;
    }

    const matched = CAPTURE_KEYWORDS.some(
      (kw) => transcript.includes(kw),
    );

    if (matched) {
      console.log('[Voice] Keyword detected → capture!');
      debouncedCapture();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[Voice] Recognition error:', event.error);
    setIsListening(false);
    // Tự restart sau 2 giây nếu vẫn ở screen này
    setTimeout(() => startVoiceListening(), 2000);
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[Voice] Recognition ended – restarting...');
    setIsListening(false);
    // Liên tục restart để luôn lắng nghe
    setTimeout(() => startVoiceListening(), 500);
  });

  // ============================================================
  // Lifecycle
  // ============================================================

  useEffect(() => {
    /**
     * Quy trình xin quyền thông minh cho người khiếm thị:
     * 1. Xin quyền Micro trước (bắt buộc thủ công lần đầu để có thể nghe lệnh giọng nói).
     * 2. Sau đó dùng giọng nói để xin quyền Camera.
     */
    (async () => {
      // --- 1. Microphone permission (Nền tảng để nghe lệnh) ---
      let micGranted = micPermission?.granted ?? false;
      if (!micGranted) {
        // Thông báo bằng giọng nói trước khi hiện popup hệ thống
        await Speech.speak('VisionVoice cần quyền sử dụng micro để nghe lệnh từ bạn. Vui lòng nhấn cho phép trên màn hình.', { language: TTS_LOCALE });
        const result = await requestMicPermission();
        micGranted = result.granted;
      }

      if (!micGranted) {
        await Speech.speak('Không có quyền micro, bạn sẽ không thể điều khiển bằng giọng nói.', { language: TTS_LOCALE });
      } else {
        // Bắt đầu nghe để chuẩn bị cho bước xin quyền camera bằng giọng nói
        await startVoiceListening();
      }

      // --- 2. Camera permission (Dùng giọng nói để xác nhận) ---
      let camGranted = cameraPermission?.granted ?? false;
      if (!camGranted) {
        await Speech.speak('VisionVoice cần quyền Camera để nhận diện hình ảnh. Vui lòng nói đồng ý để cấp quyền.', { language: TTS_LOCALE });
        setWaitingForVoicePermission(true);
        
        // Đợi người dùng nói "đồng ý" (xử lý trong useSpeechRecognitionEvent)
        // Lưu ý: Trong thực tế, ta nên có timeout hoặc polling ở đây nếu cần đồng bộ chặt chẽ
        return; 
      }

      // Nếu đã có quyền camera
      setPermissionsReady(true);
      
      // Câu chào khi app sẵn sàng
      const greetDelay = MOCK_MODE ? 600 : 400;
      setTimeout(() => {
        Speech.speak(
          MOCK_MODE
            ? 'Xin chào! VisionVoice đã sẵn sàng. Chế độ thử nghiệm đang bật. Nói chụp ảnh hoặc nhấn combo nút để bắt đầu.'
            : 'Xin chào! VisionVoice đã sẵn sàng. Nói chụp ảnh hoặc nhấn combo nút giảm âm lượng và nguồn để chụp.',
          { language: TTS_LOCALE },
        );
      }, greetDelay);
    })();

    return () => {
      stopVoiceListening();
      soundRef.current?.unloadAsync();
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theo dõi khi cameraPermission thay đổi sau khi người dùng nói "đồng ý"
  useEffect(() => {
    if (cameraPermission?.granted && !permissionsReady) {
      setPermissionsReady(true);
      setWaitingForVoicePermission(false);
      Speech.speak('Đã cấp quyền camera thành công.', { language: TTS_LOCALE });
    }
  }, [cameraPermission, permissionsReady]);

  // ============================================================
  // Loading screen – hiện trong khi đang xin permissions
  // (không có nút bấm; người khiếm thị nghe hướng dẫn qua giọng nói)
  // ============================================================

  if (!permissionsReady) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.infoText}>Đang khởi động VisionVoice...</Text>
        {MOCK_MODE && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>🧪 CHẾ ĐỘ THỬ NGHIỆM</Text>
          </View>
        )}
      </View>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  const isCapturing = captureState !== 'idle';

  return (
    <View style={styles.container}>
      {/* ── Camera preview full screen ── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
      />

      {/* ── Overlay gradient ── */}
      <View style={styles.overlayTop} pointerEvents="none" />
      <View style={styles.overlayBottom} pointerEvents="none" />

      {/* ── Top HUD ── */}
      <View style={styles.hudTop}>
        <Text style={styles.appTitle}>VisionVoice</Text>
        {MOCK_MODE && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>🧪 THỬ NGHIỆM</Text>
          </View>
        )}
        <View style={styles.indicatorRow}>
          {/* Voice listening indicator */}
          <View style={[styles.dot, isListening ? styles.dotGreen : styles.dotGray]} />
          <Text style={styles.indicatorLabel}>
            {isListening ? 'Đang nghe...' : 'Tắt mic'}
          </Text>
        </View>
      </View>

      {/* ── Status text ── */}
      {isCapturing && (
        <View style={styles.statusBanner}>
          <ActivityIndicator
            size="small"
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      )}

      {/* ── Bottom controls ── */}
      <View style={styles.bottomBar}>
        {/* Hint labels */}
        <Text style={styles.hint}>Nói "Chụp ảnh" hoặc nhấn nút âm lượng</Text>

        {/* Nút chụp UI */}
        <TouchableOpacity
          accessible
          accessibilityRole="button"
          accessibilityLabel="Chụp ảnh"
          accessibilityHint="Nhấn để chụp ảnh và nhận mô tả bằng giọng nói"
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={debouncedCapture as () => void}
          disabled={isCapturing}
          activeOpacity={0.8}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#7C3AED" />
          ) : (
            <>
              <View style={styles.captureInner} />
            </>
          )}
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ height: Platform.OS === 'ios' ? 30 : 16 }} />
      </View>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  infoText: {
    color: '#E2E8F0',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  permButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Gradient overlays
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },

  // HUD
  hudTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  appTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  mockBadge: {
    backgroundColor: 'rgba(234,179,8,0.2)',
    borderWidth: 1,
    borderColor: '#EAB308',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  mockBadgeText: {
    color: '#EAB308',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: { backgroundColor: '#22C55E' },
  dotGray: { backgroundColor: '#64748B' },
  indicatorLabel: {
    color: '#CBD5E1',
    fontSize: 13,
  },

  // Status banner
  statusBanner: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
  statusText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 0,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // Capture button
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 8,
  },
  captureButtonDisabled: {
    opacity: 0.6,
    borderColor: '#64748B',
    shadowOpacity: 0,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7C3AED',
  },
});
