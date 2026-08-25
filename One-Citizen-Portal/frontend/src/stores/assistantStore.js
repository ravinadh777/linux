import { create } from 'zustand';

const GREETING = {
  role: 'assistant',
  text: "Hi, I'm AskGov. I can help you find a service, fill in an application, or track your progress. Ask me anything.",
  actions: [],
  suggestions: ['Renew my passport', 'Apply for pension', 'Track my application'],
};

export const useAssistantStore = create((set, get) => ({
  messages: [GREETING],
  // formApi is registered by the active application form so AskGov can auto-fill it.
  formApi: null, // { serviceName, fields:[{name,label,type,options}], setValues(obj) }
  // Live progress of the active form (section, step, docs pending) — powers AskGov's
  // context-aware guidance + suggestions. Set by the form, read by the assistant panel.
  formProgress: null, // { serviceName, activeIndex, total, currentTitle, isReview, documentsPending:[], complete:bool }
  addMessage: (m) => set({ messages: [...get().messages, m] }),
  reset: () => set({ messages: [GREETING] }),
  setFormApi: (formApi) => set({ formApi }),
  clearFormApi: () => set((s) => (s.formApi || s.formProgress ? { formApi: null, formProgress: null } : s)),
  setFormProgress: (formProgress) => set({ formProgress }),
}));
