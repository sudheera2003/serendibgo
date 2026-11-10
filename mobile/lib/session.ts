import { router } from 'expo-router';
import { api } from './api';
import { useAuth } from './auth-store';
import { queryClient } from './query';
import { useCart } from './cart-store';
import type { Role, User } from './types';

export const HOME: Record<Role, string> = {
  tourist: '/tourist',
  provider: '/provider',
  vendor: '/vendor',
  admin: '/admin',
};

export async function signIn(data: { user: User; accessToken: string; refreshToken: string }) {
  queryClient.clear();
  await useAuth.getState().setSession(data);
  router.replace(HOME[data.user.role] as never);
}

export async function signOut() {
  const { refreshToken } = useAuth.getState();
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch {}
  useCart.getState().clear();
  queryClient.clear();
  await useAuth.getState().clear();
  router.replace('/welcome');
}

export async function refreshMe() {
  const { user } = await api.get<{ user: User }>('/users/me');
  await useAuth.getState().setUser(user);
  return user;
}
