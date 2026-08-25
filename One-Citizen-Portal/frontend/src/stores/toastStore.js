import { create } from 'zustand';

let seq = 0;

// Lightweight global toast queue. Components call the exported `toast` helpers; a single
// <Toast /> mounted at the app root renders them centered in the window.
export const useToastStore = create((set, get) => ({
  toasts: [],
  push: ({ type = 'info', title, message, duration = 3500 }) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, type, title, message }] }));
    if (duration) setTimeout(() => get().remove(id), duration);
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

const push = (type, message, opts = {}) => useToastStore.getState().push({ type, message, ...opts });

// Convenience API used across the app: toast.success('…'), toast.error('…'), etc.
export const toast = {
  success: (message, opts) => push('success', message, opts),
  error: (message, opts) => push('error', message, opts),
  info: (message, opts) => push('info', message, opts),
  warning: (message, opts) => push('warning', message, opts),
};
