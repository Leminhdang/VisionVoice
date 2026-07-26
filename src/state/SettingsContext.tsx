import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_TTS_PITCH, DEFAULT_TTS_RATE } from '../constants/config';
import { setTtsDefaults } from '../services/tts';

export type ObstacleSensitivity = 'low' | 'medium' | 'high';

export interface AppSettings {
  ttsRate: number;
  ttsPitch: number;
  obstacleSensitivity: ObstacleSensitivity;
}

export interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  isLoaded: boolean;
}

const SETTINGS_STORAGE_KEY = 'visionvoice.settings';

const DEFAULT_SETTINGS: AppSettings = {
  ttsRate: DEFAULT_TTS_RATE,
  ttsPitch: DEFAULT_TTS_PITCH,
  obstacleSensitivity: 'medium',
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isObstacleSensitivity(value: unknown): value is ObstacleSensitivity {
  return value === 'low' || value === 'medium' || value === 'high';
}

/**
 * Never trust stored data: validate field-by-field and fall back
 * to defaults for any missing or malformed field.
 */
function parseStoredSettings(raw: string): AppSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('Lỗi khi phân tích cài đặt đã lưu:', err);
    return DEFAULT_SETTINGS;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_SETTINGS;
  }

  const stored = parsed as Record<string, unknown>;
  return {
    ttsRate: isFiniteNumber(stored.ttsRate) ? stored.ttsRate : DEFAULT_SETTINGS.ttsRate,
    ttsPitch: isFiniteNumber(stored.ttsPitch) ? stored.ttsPitch : DEFAULT_SETTINGS.ttsPitch,
    obstacleSensitivity: isObstacleSensitivity(stored.obstacleSensitivity)
      ? stored.obstacleSensitivity
      : DEFAULT_SETTINGS.obstacleSensitivity,
  };
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (!isMounted) {
          return;
        }
        if (raw !== null) {
          setSettings(parseStoredSettings(raw));
        }
        setIsLoaded(true);
      })
      .catch((err: unknown) => {
        console.warn('Lỗi khi tải cài đặt:', err);
        if (isMounted) {
          setIsLoaded(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Keep the global TTS defaults in sync with the current settings.
    setTtsDefaults({ rate: settings.ttsRate, pitch: settings.ttsPitch });

    if (!isLoaded) {
      return;
    }
    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch(
      (err: unknown) => {
        console.warn('Lỗi khi lưu cài đặt:', err);
      },
    );
  }, [settings, isLoaded]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, isLoaded }),
    [settings, updateSettings, isLoaded],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === null) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
