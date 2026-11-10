import { create } from 'zustand';
import { secureStorage } from './secure-storage';
import type { User } from './types';

const KEY = 'serendibgo.session';

interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrate: () => Promise<void>;
  setSession: (s: Session) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clear: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  refreshToken: null,

  async hydrate() {
    try {
      const raw = await secureStorage.get(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        set({ ...s, status: 'signedIn' });
        return;
      }
    } catch {}
    set({ status: 'signedOut' });
  },

  async setSession(s) {
    await secureStorage.set(KEY, JSON.stringify(s));
    set({ ...s, status: 'signedIn' });
  },

  async setTokens(accessToken, refreshToken) {
    const { user } = get();
    if (!user) return;
    await secureStorage.set(KEY, JSON.stringify({ user, accessToken, refreshToken }));
    set({ accessToken, refreshToken });
  },

  async setUser(user) {
    const { accessToken, refreshToken } = get();
    if (accessToken && refreshToken) await secureStorage.set(KEY, JSON.stringify({ user, accessToken, refreshToken }));
    set({ user });
  },

  async clear() {
    await secureStorage.remove(KEY);
    set({ status: 'signedOut', user: null, accessToken: null, refreshToken: null });
  },
}));
