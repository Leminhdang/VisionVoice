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
  const cameraRef = useRef<CameraView>(null);
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
    if (!cameraRef.current) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch((e) => console.warn(e));
      playCameraSound();
      setCaptureState('capturing');
      setStatusText('Đang chụp ảnh...');
      setSelectedImage(null);
      setGeneratedCaption('');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
      });

      if (!photo?.uri) throw new Error('Không lấy được URI ảnh.');

      setSelectedImage(photo.uri);
      await processImage(photo.uri, true);
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
    const volumeSubscription = VolumeManager.addVolumeListener((result) => {
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
    console.log('Capture detected', transcript);
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

  useSpeechRecognitionEvent('error', (event) => {
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
            ? 'Xin chào! VisionVoice đã sẵn sàng ở chế độ thử nghiệm. Hãy bấm chụp, chọn ảnh hoặc ra lệnh bằng giọng nói.'
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
  }, [micPermission, cameraPermission, startVoiceListening, stopVoiceListening]);

  if (!permissionsReady) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.infoText}>Đang khởi động VisionVoice...</Text>
        {MOCK_MODE && (
          <View style={styles.mockBadge}>
            <Text style={styles.mockBadgeText}>🧪 CHẾ ĐỘ THỬ NGHIỆM</Text>
          </View>
        )}
      </View>
    );
  }

  const isProcessing = captureState === 'capturing' || captureState === 'analyzing' || captureState === 'speaking';
  const hasResult = selectedImage !== null;

  return (
    <View style={styles.container}>
      {!hasResult ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            pictureSize={selectedPictureSize}
            onCameraReady={onCameraReady}
          />
          <View style={styles.overlayTop} pointerEvents="none" />
          <View style={styles.overlayBottom} pointerEvents="none" />
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>KẾT QUẢ PHÂN TÍCH</Text>
              <View style={styles.gritBadge}>
                <Text style={styles.gritBadgeText}>🤖 GRIT KTVIC MODEL</Text>
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
                <Text style={styles.captionCardTitle}>Mô tả tiếng Việt</Text>
              </View>
              {captureState === 'analyzing' ? (
                <View style={styles.captionLoadingRow}>
                  <ActivityIndicator size="small" color="#818CF8" style={{ marginRight: 10 }} />
                  <Text style={styles.captionLoadingText}>Đang phân tích dữ liệu ảnh...</Text>
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
                <Text style={styles.actionButtonText}>CHỤP ẢNH MỚI</Text>
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

      <View style={styles.hudTop}>
        <View style={styles.hudLeft}>
          <Text style={styles.appTitle}>VisionVoice</Text>
          {MOCK_MODE && (
            <View style={styles.mockBadgeInline}>
              <Text style={styles.mockBadgeTextInline}>🧪 THỬ NGHIỆM</Text>
            </View>
          )}
        </View>

        <View style={styles.hudRight}>
          <View style={styles.listeningBadge}>
            <View style={[styles.dot, isListening ? styles.dotGreen : styles.dotGray]} />
            <Text style={styles.listeningText}>{isListening ? 'Giọng nói ON' : 'Mute'}</Text>
          </View>
{/* 
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              setApiUrlInput(apiUrl);
              setIsSettingsOpen(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            accessibilityLabel="Cài đặt máy chủ"
          >
            <Ionicons name="settings-sharp" size={22} color="#FFF" />
          </TouchableOpacity> */}
        </View>
      </View>

      {!hasResult && (
        <View style={styles.bottomBar}>
          <Text style={styles.hint}>Nói "Chụp ảnh", chụp phím âm lượng hoặc chọn từ thư viện</Text>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.galleryTrigger}
              onPress={pickImage}
              accessibilityLabel="Chọn ảnh từ thư viện"
              accessibilityHint="Mở thư viện ảnh để phân tích"
              activeOpacity={0.75}
            >
              <Ionicons name="images-outline" size={26} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              accessible
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh"
              accessibilityHint="Nhấn để chụp ảnh và phân tích mô tả bằng giọng nói"
              style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
              onPress={debouncedCapture as () => void}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              {captureState === 'capturing' ? (
                <ActivityIndicator size="large" color="#6366F1" />
              ) : (
                <View style={styles.captureInner} />
              )}
            </TouchableOpacity>

            <View style={styles.layoutPlaceholder}>
              {/* <Ionicons name={isListening ? "mic" : "mic-off"} size={24} color={isListening ? "#818CF8" : "#64748B"} /> */}
            </View>
          </View>

          <View style={{ height: Platform.OS === 'ios' ? 30 : 16 }} />
        </View>
      )}


      <Modal
        visible={isSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="link-sharp" size={22} color="#818CF8" />
              <Text style={styles.modalTitle}>CẤU HÌNH LIÊN KẾT COLAB</Text>
            </View>

            <ScrollView bounces={false} style={styles.modalBody}>
              <Text style={styles.modalDesc}>
                Nhập public URL (ngrok/cloudflared) do máy chủ Colab cấp để ứng dụng gọi API mô hình GRIT fine-tune.
              </Text>

              <View style={styles.urlInputRow}>
                <Text style={styles.inputLabel}>Địa chỉ API:</Text>
                <TextInput
                  style={styles.urlInput}
                  value={apiUrlInput}
                  onChangeText={setApiUrlInput}
                  placeholder="https://xxxxx.ngrok-free.app"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={styles.statusLabel}>
                Địa chỉ hiện tại: <Text style={styles.statusLabelBold}>{apiUrl}</Text>
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsSettingsOpen(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.cancelButtonText}>HỦY BỎ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveApiUrl}
              >
                <Text style={styles.saveButtonText}>CẬP NHẬT</Text>
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
    backgroundColor: '#07070E',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0A0A16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  infoText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  mockBadge: {
    backgroundColor: 'rgba(234,179,8,0.15)',
    borderWidth: 1,
    borderColor: '#EAB308',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  mockBadgeText: {
    color: '#EAB308',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(7, 7, 14, 0.65)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: 'rgba(7, 7, 14, 0.75)',
  },
  hudTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(99, 102, 241, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  mockBadgeInline: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mockBadgeTextInline: {
    color: '#EAB308',
    fontSize: 10,
    fontWeight: '700',
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: { 
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotGray: { backgroundColor: '#64748B' },
  listeningText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Giao diện kết quả
  resultContainer: {
    flex: 1,
    backgroundColor: '#090911',
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 110 : 90,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 14,
    color: '#818CF8',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  gritBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gritBadgeText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
  },
  imageCardOuter: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 20,
    backgroundColor: '#131322',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 20,
    padding: 6,
  },
  imageCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  resultImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  captionCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  captionIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  captionCardTitle: {
    fontSize: 14,
    color: '#A5B4FC',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  captionText: {
    fontSize: 17,
    color: '#FFF',
    lineHeight: 25,
    fontWeight: '500',
  },
  captionLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  captionLoadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  ttsButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 4,
  },
  ttsButtonIdle: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  ttsButtonSpeaking: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  ttsButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  captureNextButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  galleryNextButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 8,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 36,
  },
  galleryTrigger: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 12,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#6366F1',
  },
  layoutPlaceholder: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 14, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: '#111122',
    borderColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  loadingTextOverlay: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtitleOverlay: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#111122',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalBody: {
    padding: 20,
    maxHeight: 300,
  },
  modalDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  urlInputRow: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  urlInput: {
    backgroundColor: '#07070E',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    color: '#FFF',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  statusLabelBold: {
    color: '#FFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#4F46E5',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
