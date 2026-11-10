import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL.
 * 1. EXPO_PUBLIC_API_URL in mobile/.env wins (use this for a deployed API).
 * 2. Otherwise the app talks to port 4000 on the same computer that runs Metro,
 *    so a phone using Expo Go on the same Wi-Fi works without any setup.
 * 3. Through `expo start --tunnel` it talks to Metro itself, which forwards to port 4000
 *    (see metro.config.js).
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host?.endsWith('.exp.direct')) return `http://${host}`;
  if (host) return `http://${host}:4000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();
export const API = `${API_URL}/api/v1`;
