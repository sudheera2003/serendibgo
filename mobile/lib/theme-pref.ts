import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { create } from 'zustand';

const KEY = 'serendibgo.theme';
type Mode = 'light' | 'dark';

/** The app's light/dark choice (light by default), shared by NativeWind classes and navigation headers. */
export const useThemeMode = create<{ mode: Mode }>(() => ({ mode: 'light' }));

function apply(mode: Mode) {
  colorScheme.set(mode);
  useThemeMode.setState({ mode });
}

export async function loadThemePreference() {
  try {
    apply(((await AsyncStorage.getItem(KEY)) as Mode | null) ?? 'light');
  } catch {
    apply('light');
  }
}

export async function saveThemePreference(mode: Mode) {
  apply(mode);
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {}
}
