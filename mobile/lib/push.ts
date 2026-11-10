import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Registers this device for push notifications through the Expo Push Service.
 * Push needs a real device and a development/production build (Expo Go on Android
 * no longer supports remote push), so failures are ignored: the in-app
 * notification centre keeps working either way.
 */
export async function registerForPush() {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  // Expo Go cannot receive remote push (and loading the module there logs errors), so skip it.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api.post('/users/me/device-tokens', { token, platform: Platform.OS });
  } catch (e) {
    console.log('[push] not available here:', (e as Error).message);
  }
}
