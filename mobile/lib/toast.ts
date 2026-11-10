import { create } from 'zustand';
import { errorMessage } from './api';

export type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  show: (kind: ToastKind, title: string, message?: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (kind, title, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, title, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 5000 : 3000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToasts.getState().show('success', title, message),
  error: (e: unknown, title = 'Something went wrong') => useToasts.getState().show('error', title, errorMessage(e)),
  info: (title: string, message?: string) => useToasts.getState().show('info', title, message),
};
