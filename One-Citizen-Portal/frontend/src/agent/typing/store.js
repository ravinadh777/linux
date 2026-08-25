// Live typing status — powers the visual experience (status pill, active-field highlight,
// AI icon beside the field being typed, chat/typing synchronization). Written by the engine,
// read by the form + assistant panel via selector subscriptions.
import { create } from 'zustand';

export const useTypingStore = create((set) => ({
  active: false,        // is the agent currently filling the form?
  status: 'idle',       // 'idle' | 'thinking' | 'typing'
  fieldName: null,      // field currently being filled (for the AI icon + highlight)
  fieldLabel: null,     // human label (for the "Typing … " status text)

  start: () => set({ active: true, status: 'typing' }),
  focusField: (fieldName, fieldLabel, status = 'typing') => set({ active: true, status, fieldName, fieldLabel }),
  think: (fieldLabel) => set({ active: true, status: 'thinking', fieldLabel }),
  stop: () => set({ active: false, status: 'idle', fieldName: null, fieldLabel: null }),
}));

export const useTypingActiveField = () => useTypingStore((s) => (s.active ? s.fieldName : null));
