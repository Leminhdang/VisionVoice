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
  Image,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  Frame,
} from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { VolumeManager } from 'react-native-volume-manager';
import * as ScreenCapture from 'expo-screen-capture';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { analyzeImage, updateApiBaseUrl } from '../services/api';
import { useDebounceCallback } from '../hooks/useDebounceCallback';
import { useObstacleDetection } from '../hooks/useObstacleDetection';
import {
  CAPTURE_FEEDBACK_PHRASE,
  CAPTURE_KEYWORDS,
  MOCK_DESCRIPTION,
  MOCK_MODE,
  SPEECH_RECOGNITION_LOCALE,
  TTS_LOCALE,
  API_BASE_URL,
} from '../constants/config';

type CaptureState = 'idle' | 'capturing' | 'analyzing' | 'speaking' | 'idle_with_result';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const RESET_KEYWORDS = [
  'quay lại', 'chụp tiếp', 'chụp lại', 'tiếp tục', 'quay lai', 'chup tiep', 'chup lai', 'tiep tuc', 'thử lại', 'thu lai',
  'mới', 'ảnh mới', 'anh moi', 'moi'
];
const SPEAK_KEYWORDS = [
  'đọc lại', 'nghe lại', 'đọc mô tả', 'đọc', 'doc lai', 'nghe lai', 'doc mo ta', 'doc', 'đọc lại kết quả', 'nghe lại kết quả'
];

export default function CameraScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const { hasPermission: hasVisionPermission, requestPermission: requestVisionPermission } = useCameraPermission();

  const cameraRef = useRef<CameraView>(null);
  const visionCameraRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const hasRequestedPermissions = useRef(false);
  const lastResetTimeRef = useRef<number>(0);

  const [facing] = useState<CameraType>('back');
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [statusText, setStatusText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [apiUrl, setApiUrl] = useState<string>(API_BASE_URL);
  const [apiUrlInput, setApiUrlInput] = useState<string>(API_BASE_URL);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPictureSize, setSelectedPictureSize] = useState<string | undefined>(undefined);

  // Bật/Tắt chế độ Quét Vật Cản Offline
  const [isObstacleEnabled, setIsObstacleEnabled] = useState(true);

  // Tắt quét cảnh báo tạm thời khi đang chụp / phân tích / đọc kết quả từ Gemini
  const isScanningActive = isObstacleEnabled && (captureState === 'idle' || captureState === 'idle_with_result');

  // Custom Hook: Quét vật cản Offline với ML Kit Object Detection
  const { threatLevel, maxRatio, detectedCount, frameProcessor } = useObstacleDetection({
    isEnabled: isScanningActive,
    alertIntervalMs: 1500,
  });

  // Vision Camera device
  const visionDevice = useCameraDevice('back');

  const onCameraReady = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      let bestSize = sizes[0];
      let minDiff = Infinity;
      for (const size of sizes) {
        const parts = size.split('x');
        if (parts.length === 2) {
          const w = parseInt(parts[0], 10);
          const h = parseInt(parts[1], 10);
          const maxDim = Math.max(w, h);
          const diff = Math.abs(maxDim - 1280);
          if (diff < minDiff) {
            minDiff = diff;
            bestSize = size;
          }
        }
      }
      if (bestSize) {
        setSelectedPictureSize(bestSize);
      }
    } catch (err) {
      console.warn('Lỗi khi lấy kích thước ảnh:', err);
    }
  }, []);

  const resetState = useCallback(() => {
    setCaptureState('idle');
    setSelectedImage(null);
    setGeneratedCaption('');
    setStatusText('');
    setIsSpeaking(false);
    lastResetTimeRef.current = Date.now();
  }, []);

  const processImage = async (uri: string, isFromCamera: boolean) => {
    try {
      setCaptureState('analyzing');
      setStatusText('GRIT đang phân tích...');
      setGeneratedCaption('');
      Speech.speak(CAPTURE_FEEDBACK_PHRASE, { language: TTS_LOCALE });

      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      let description: string;
      if (MOCK_MODE) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        description = MOCK_DESCRIPTION;
      } else {
        description = await analyzeImage(manipulated.uri);
      }

      setGeneratedCaption(description);
      setCaptureState('speaking');
      setStatusText('Đang đọc kết quả...');
      setIsSpeaking(true);

      await Speech.speak(description, {
        language: TTS_LOCALE,
        pitch: 1.0,
        rate: 0.9,
        onDone: resetState,
        onError: resetState,
      });
    } catch (err) {
      console.warn('Lỗi khi phân tích ảnh:', err);
      setIsSpeaking(true);
      if (isFromCamera) {
        setStatusText('Lỗi kết nối server.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      const errMsg = isFromCamera
        ? 'Đã xảy ra lỗi khi phân tích ảnh. Vui lòng kiểm tra lại server.'
        : 'Đã xảy ra lỗi khi phân tích ảnh. Vui lòng kiểm tra lại kết nối.';

      setGeneratedCaption(errMsg);

      Speech.speak(errMsg, {
        language: TTS_LOCALE,
        onDone: resetState,
        onError: resetState,
      });
    }
  };

  const playCameraSound = useCallback(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
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
      console.warn('Lỗi khi phát âm thanh máy ảnh:', e);
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (captureState !== 'idle' && captureState !== 'idle_with_result') {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch((e) => console.warn(e));
      playCameraSound();

      setCaptureState('capturing');
      setStatusText('Đang chụp ảnh...');
      setSelectedImage(null);
      setGeneratedCaption('');

      let capturedUri: string | null = null;

      // Ưu tiên chụp ảnh bằng Vision Camera (Online Gemini Stream)
      if (visionCameraRef.current) {
        const photo = await visionCameraRef.current.takePhoto({
          qualityPrioritization: 'speed',
          flash: 'off',
        });
        capturedUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      } else if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
        });
        capturedUri = photo?.uri || null;
      }

      if (!capturedUri) throw new Error('Không lấy được URI ảnh.');

      setSelectedImage(capturedUri);
      await processImage(capturedUri, true);
    } catch (err) {
      console.warn('Lỗi khi chụp ảnh:', err);
      resetState();
    }
  }, [captureState, playCameraSound, resetState]);

  const debouncedCapture = useDebounceCallback(captureAndAnalyze as (...args: unknown[]) => void);

  const pickImage = async () => {
    if (captureState !== 'idle' && captureState !== 'idle_with_result') return;
    try {
      await Speech.stop();
      setIsSpeaking(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        setSelectedImage(pickedUri);
        await processImage(pickedUri, false);
      }
    } catch (e) {
      console.warn('Lỗi khi chọn ảnh:', e);
      Speech.speak('Không thể mở thư viện ảnh.', { language: TTS_LOCALE });
    }
  };

  const resetToCamera = useCallback(() => {
    Speech.stop();
    resetState();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Speech.speak('Đã quay lại chế độ máy ảnh.', { language: TTS_LOCALE });
  }, [resetState]);

  const speakCaption = async () => {
    if (!generatedCaption) return;

    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSpeaking(true);
      await Speech.speak(generatedCaption, {
        language: TTS_LOCALE,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (e) {
      console.warn('Lỗi khi đọc mô tả:', e);
      setIsSpeaking(false);
    }
  };

  const saveApiUrl = () => {
    const cleanUrl = apiUrlInput.trim();
    if (!cleanUrl) {
      Speech.speak('Đầu vào máy chủ không được để trống.', { language: TTS_LOCALE });
      return;
    }
    updateApiBaseUrl(cleanUrl);
    setApiUrl(cleanUrl);
    setIsSettingsOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Speech.speak('Đã cập nhật cấu hình kết nối mới thành công.', { language: TTS_LOCALE });
  };

  useEffect(() => {
    const volumeSubscription = VolumeManager.addVolumeListener(() => {
      if (Date.now() - lastResetTimeRef.current < 1500) {
        return;
      }
      debouncedCapture();
    });

    const screenshotSubscription = ScreenCapture.addScreenshotListener(() => {
      if (Date.now() - lastResetTimeRef.current < 1500) {
        return;
      }
      debouncedCapture();
    });

    return () => {
      volumeSubscription.remove();
      screenshotSubscription.remove();
    };
  }, [debouncedCapture]);

  const startVoiceListening = useCallback(async () => {
    const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permResult.granted) {
      return;
    }

    try {
      ExpoSpeechRecognitionModule.start({
        lang: SPEECH_RECOGNITION_LOCALE,
        interimResults: true,
        continuous: true,
      });
      setIsListening(true);
    } catch (e) {
      console.warn('Lỗi khi bắt đầu nhận diện giọng nói:', e);
    }
  }, []);

  const stopVoiceListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    } catch (e) {
      console.warn('Lỗi khi dừng nhận diện giọng nói:', e);
    }
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.toLowerCase().trim() ?? '';
    if (!transcript) return;

    if (captureState === 'idle') {
      if (Date.now() - lastResetTimeRef.current < 1500) {
        return;
      }
      const matched = CAPTURE_KEYWORDS.some((kw) => transcript.includes(kw));
      if (matched) {
        debouncedCapture();
        return;
      }
    }

    if (captureState === 'idle_with_result') {
      const matchedReset = RESET_KEYWORDS.some((kw) => transcript.includes(kw));
      if (matchedReset) {
        resetToCamera();
        return;
      }

      const matchedSpeak = SPEAK_KEYWORDS.some((kw) => transcript.includes(kw));
      if (matchedSpeak) {
        speakCaption();
        return;
      }
    }
  });

  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
    setTimeout(() => startVoiceListening(), 2000);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    setTimeout(() => startVoiceListening(), 500);
  });

  useEffect(() => {
    if (!micPermission || !cameraPermission) {
      return;
    }

    if (hasRequestedPermissions.current) {
      return;
    }
    hasRequestedPermissions.current = true;

    const requestAllPermissions = async () => {
      try {
        let micGranted = micPermission.granted;
        let camGranted = cameraPermission.granted;

        if (!hasVisionPermission) {
          await requestVisionPermission();
        }

        if (!micGranted) {
          await Speech.speak(
            'VisionVoice cần quyền sử dụng micro để nhận lệnh giọng nói. Vui lòng nhấn đúp vào nút Cho phép trên màn hình.',
            { language: TTS_LOCALE }
          );

          await new Promise((resolve) => setTimeout(resolve, 3000));

          const resultMic = await requestMicPermission();
          micGranted = resultMic.granted;
        }

        if (micGranted) {
          await startVoiceListening();
        } else {
          await Speech.speak('Không có quyền micro, bạn sẽ không thể điều khiển bằng giọng nói.', { language: TTS_LOCALE });
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }

        if (!camGranted) {
          await Speech.speak(
            'VisionVoice cần quyền truy cập Camera để nhận diện hình ảnh. Vui lòng nhấn đúp vào nút Cho phép tiếp theo.',
            { language: TTS_LOCALE }
          );

          await new Promise((resolve) => setTimeout(resolve, 3000));

          const resultCam = await requestCameraPermission();
          camGranted = resultCam.granted;
        }

        if (camGranted) {
          setPermissionsReady(true);

          const welcomeMessage = MOCK_MODE
            ? 'Xin chào! VisionVoice đã sẵn sàng ở chế độ thử nghiệm với Quét Vật Cản Offline.'
            : 'Xin chào! VisionVoice đã sẵn sàng.';

          await Speech.speak(welcomeMessage, { language: TTS_LOCALE });
        } else {
          await Speech.speak('Không có quyền camera, ứng dụng không thể nhận diện hình ảnh giúp bạn.', { language: TTS_LOCALE });
        }
      } catch (error) {
        console.warn('Lỗi trong quá trình xin quyền:', error);
      }
    };

    requestAllPermissions();

    return () => {
      stopVoiceListening();
      soundRef.current?.unloadAsync();
      Speech.stop();
    };
  }, [micPermission, cameraPermission, hasVisionPermission, requestVisionPermission, requestCameraPermission, requestMicPermission, startVoiceListening, stopVoiceListening]);

  if (!permissionsReady) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.infoText}>Đang khởi động VisionVoice & Quét Vật Cản...</Text>
        {MOCK_MODE && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>🧪 CHẾ ĐỘ THỬ NGHIỆM AI</Text>
          </View>
        )}
      </View>
    );
  }

  const isProcessing = captureState === 'capturing' || captureState === 'analyzing' || captureState === 'speaking';
  const hasResult = selectedImage !== null;

  // Lấy kiểu badge giao diện dựa trên ThreatLevel
  const getThreatStyle = () => {
    switch (threatLevel) {
      case 'danger':
        return { backgroundColor: '#EF4444', icon: 'alert-circle', text: 'NGUY HIỂM (DANGER)' };
      case 'warning':
        return { backgroundColor: '#F59E0B', icon: 'warning', text: 'CẢNH BÁO (WARNING)' };
      case 'safe':
      default:
        return { backgroundColor: '#10B981', icon: 'shield-checkmark', text: 'AN TOÀN (SAFE)' };
    }
  };

  const threatStyle = getThreatStyle();
  const VisionCameraComponent = VisionCamera as any;

  return (
    <View style={styles.container}>
      {!hasResult ? (
        <View style={StyleSheet.absoluteFill}>
          {visionDevice ? (
            <VisionCameraComponent
              ref={visionCameraRef}
              style={StyleSheet.absoluteFill}
              device={visionDevice}
              isActive={true}
              photo={true}
              frameProcessor={frameProcessor}
              pixelFormat="yuv"
            />
          ) : (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              pictureSize={selectedPictureSize}
              onCameraReady={onCameraReady}
            />
          )}

          <View style={styles.overlayTop} pointerEvents="none" />
          <View style={styles.overlayBottom} pointerEvents="none" />

          {/* Banner Cảnh Báo Vật Cản Thời Gian Thực (Offline AI HUD) */}
          <View style={styles.obstacleHud}>
            <View style={[styles.threatBadge, { backgroundColor: threatStyle.backgroundColor }]}>
              <Ionicons name={threatStyle.icon as any} size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.threatBadgeText}>{threatStyle.text}</Text>
            </View>
            <View style={styles.obstacleInfoRow}>
              <Text style={styles.obstacleInfoText}>
                Diện tích vật cản: <Text style={styles.obstacleInfoHighlight}>{(maxRatio * 100).toFixed(1)}%</Text>
              </Text>
              <Text style={styles.obstacleInfoText}>
                Số vật thể: <Text style={styles.obstacleInfoHighlight}>{detectedCount}</Text>
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>KẾT QUẢ PHÂN TÍCH</Text>
              <View style={styles.gritBadge}>
                <Text style={styles.gritBadgeText}>🤖 GEMINI BACKEND MODEL</Text>
              </View>
            </View>

            <View style={styles.imageCardOuter}>
              <View style={styles.imageCard}>
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.resultImage}
                  resizeMode="cover"
                />
              </View>
            </View>

            <View style={styles.captionCard}>
              <View style={styles.captionIconRow}>
                <MaterialCommunityIcons name="comment-text-multiple-outline" size={20} color="#818CF8" />
                <Text style={styles.captionCardTitle}>Mô tả tiếng Việt chi tiết</Text>
              </View>
              {captureState === 'analyzing' ? (
                <View style={styles.captionLoadingRow}>
                  <ActivityIndicator size="small" color="#818CF8" style={{ marginRight: 10 }} />
                  <Text style={styles.captionLoadingText}>Đang gửi tới Gemini Backend...</Text>
                </View>
              ) : (
                <Text style={styles.captionText}>
                  {generatedCaption || 'Chưa nhận dạng được mô tả.'}
                </Text>
              )}
            </View>

            {generatedCaption !== '' && (
              <TouchableOpacity
                style={[
                  styles.ttsButton,
                  isSpeaking ? styles.ttsButtonSpeaking : styles.ttsButtonIdle
                ]}
                onPress={speakCaption}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isSpeaking ? "volume-mute" : "volume-high"}
                  size={24}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.ttsButtonText}>
                  {isSpeaking ? 'DỪNG ĐỌC MÔ TẢ' : 'ĐỌC MÔ TẢ BẰNG GIỌNG NÓI'}
                </Text>
                {isSpeaking && <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            )}

            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.captureNextButton]}
                onPress={resetToCamera}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionButtonText}>QUAY LẠI MÁY ẢNH</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.galleryNextButton]}
                onPress={pickImage}
                activeOpacity={0.8}
              >
                <Ionicons name="images" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionButtonText}>CHỌN ẢNH KHÁC</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      )}

      {/* Header HUD */}
      <View style={styles.hudTop}>
        <View style={styles.hudLeft}>
          <Text style={styles.appTitle}>VisionVoice AI</Text>
          {MOCK_MODE && (
            <View style={styles.mockBadgeInline}>
              <Text style={styles.mockBadgeTextInline}>🧪 THỬ NGHIỆM</Text>
            </View>
          )}
        </View>

        <View style={styles.hudRight}>
          <TouchableOpacity
            style={[styles.toggleScanButton, isObstacleEnabled ? styles.toggleScanActive : styles.toggleScanInactive]}
            onPress={() => {
              setIsObstacleEnabled(!isObstacleEnabled);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Speech.speak(isObstacleEnabled ? 'Đã tắt quét vật cản.' : 'Đã bật quét vật cản.', { language: TTS_LOCALE });
            }}
          >
            <Ionicons name={isObstacleEnabled ? 'eye' : 'eye-off'} size={16} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.toggleScanText}>{isObstacleEnabled ? 'Quét AI ON' : 'Quét OFF'}</Text>
          </TouchableOpacity>

          <View style={styles.listeningBadge}>
            <View style={[styles.dot, isListening ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.listeningText}>{isListening ? 'Giọng nói ON' : 'Mute'}</Text>
          </View>
        </View>
      </View>

      {!hasResult && (
        <View style={styles.bottomBar}>
          <Text style={styles.hint}>Nói "Chụp ảnh" hoặc bấm nút dưới để mô tả bằng Gemini</Text>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.sideButton}
              onPress={pickImage}
              disabled={isProcessing}
              accessibilityLabel="Chọn ảnh từ thư viện"
            >
              <Ionicons name="images-outline" size={28} color="#FFF" />
              <Text style={styles.sideButtonLabel}>Thư viện</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shutterButtonOuter, isProcessing && styles.shutterDisabled]}
              onPress={debouncedCapture}
              disabled={isProcessing}
              activeOpacity={0.8}
              accessibilityLabel="Bấm để chụp ảnh và mô tả"
            >
              <View style={styles.shutterButtonInner}>
                {isProcessing ? (
                  <ActivityIndicator size="large" color="#6366F1" />
                ) : (
                  <Ionicons name="scan-circle" size={54} color="#6366F1" />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sideButton}
              onPress={() => {
                setApiUrlInput(apiUrl);
                setIsSettingsOpen(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              accessibilityLabel="Cài đặt cấu hình kết nối"
            >
              <Ionicons name="settings-outline" size={28} color="#FFF" />
              <Text style={styles.sideButtonLabel}>Cài đặt</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Cài Đặt Server API */}
      <Modal
        visible={isSettingsOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cấu hình kết nối Gemini Backend</Text>

            <Text style={styles.inputLabel}>URL máy chủ Backend:</Text>
            <TextInput
              style={styles.textInput}
              value={apiUrlInput}
              onChangeText={setApiUrlInput}
              placeholder="https://your-ngrok-domain.ngrok-free.dev"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsSettingsOpen(false)}
              >
                <Text style={styles.modalButtonText}>HỦY</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveApiUrl}
              >
                <Text style={styles.modalButtonText}>LƯU CẤU HÌNH</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoText: {
    color: '#E0E7FF',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  mockBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  mockBadgeText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hudTop: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 35,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mockBadgeInline: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  mockBadgeTextInline: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  toggleScanActive: {
    backgroundColor: '#6366F1',
  },
  toggleScanInactive: {
    backgroundColor: '#4B5563',
  },
  toggleScanText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotGray: {
    backgroundColor: '#9CA3AF',
  },
  listeningText: {
    color: '#E0E7FF',
    fontSize: 11,
  },
  obstacleHud: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 85,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 15, 26, 0.85)',
    borderRadius: 12,
    padding: 10,
    zIndex: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  threatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  threatBadgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  obstacleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  obstacleInfoText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  obstacleInfoHighlight: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    color: '#E0E7FF',
    fontSize: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  sideButtonLabel: {
    color: '#FFF',
    fontSize: 11,
    marginTop: 4,
  },
  shutterButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gritBadge: {
    backgroundColor: '#3730A3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gritBadgeText: {
    color: '#C7D2FE',
    fontSize: 10,
    fontWeight: 'bold',
  },
  imageCardOuter: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageCard: {
    width: '100%',
    height: 250,
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  captionCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  captionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  captionCardTitle: {
    color: '#818CF8',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  captionLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  captionLoadingText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  captionText: {
    color: '#F3F4F6',
    fontSize: 16,
    lineHeight: 24,
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  ttsButtonIdle: {
    backgroundColor: '#4F46E5',
  },
  ttsButtonSpeaking: {
    backgroundColor: '#DC2626',
  },
  ttsButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  captureNextButton: {
    backgroundColor: '#2563EB',
  },
  galleryNextButton: {
    backgroundColor: '#475569',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0F0F1A',
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#4B5563',
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
