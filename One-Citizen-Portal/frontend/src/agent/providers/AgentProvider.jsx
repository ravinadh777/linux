// AgentProvider (Phase 5 — provider/hooks; Phase 6 — bidirectional form sync + AUTO-FILL;
// Phase 8 — event-driven dispatch). Owns the run lifecycle, the AG-UI event->store
// dispatcher, session bootstrap/resume, and — when auto-fill is on — DIRECTLY writes the
// agent's proposed values into the live form field-by-field (the AG-UI experience). All
// action callbacks are memoised so the context value is stable across streaming updates.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AgentContext } from '../context/AgentContext.js';
import { AguiEvent, CustomPayload, AgentTrigger } from '../constants/events.js';
import { agentApi, streamChat } from '../services/agentService.js';
import { useMessageStore } from '../stores/messageStore.js';
import { useSessionStore } from '../stores/sessionStore.js';
import { usePrefsStore } from '../stores/prefsStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useAssistantStore } from '../../stores/assistantStore.js';
import { useExecutionStore } from '../execution/executionStore.js';
import { mapValuesToFields } from '../../features/apply/prefillFromProfile.js';

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 11)}`;
const FIELD_STAGGER_MS = 180; // delay between each field write, for the "typing into the form" feel
const routeLabel = (path) => {
  const seg = (path || '/').split('/').filter(Boolean);
  if (!seg.length) return 'Home';
  return seg[seg.length - 1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function AgentProvider({ children }) {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);

  const abortRef = useRef(null);
  const lastRunRef = useRef(null);
  const lastAppliedRef = useRef([]); // field names the agent last wrote (for undo)
  const routeRef = useRef(location.pathname);
  useEffect(() => { routeRef.current = location.pathname; }, [location.pathname]);

  // Raw AG-UI event fan-out for consumers that want the protocol stream (Phase 8 — Event Hook).
  const listenersRef = useRef(new Set());
  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  // ── page / shared-state builder (AG-UI state) ──────────────────────────────
  const buildPage = useCallback(() => {
    const fa = useAssistantStore.getState().formApi;
    const route = routeRef.current;
    if (fa) {
      return {
        currentPage: fa.serviceName || routeLabel(route),
        route,
        serviceId: fa.serviceId,
        serviceName: fa.serviceName,
        formFields: fa.fields,
        formValues: fa.getSnapshot?.() || {},
      };
    }
    return { currentPage: routeLabel(route), route };
  }, []);

  // ── AUTO-FILL: write proposed values into the live form field-by-field ──────
  const autoApply = useCallback((prefill) => {
    const fa = useAssistantStore.getState().formApi;
    const { autoFill, markFilled } = usePrefsStore.getState();
    if (!fa || !autoFill || !prefill?.values) return;
    // A chat prefill is an EXPLICIT "fill this from my records" request → hand control to the
    // agent (the only path back to owner=agent after the user has taken over).
    useExecutionStore.getState().handToAgent();
    // Reconcile the agent payload's keys to THIS form's field names (single mapping + dev warn),
    // so every value routes to the correct input and mismatches surface instead of failing silently.
    const values = mapValuesToFields(prefill.values, fa.fields || []);
    lastAppliedRef.current = Object.keys(values);
    // Prefer the form's human-like, section-by-section animated fill (Typing Engine).
    if (fa.autoFillSequential) { fa.autoFillSequential(values); return; }
    // Fallback: staggered flat fill (forms that only expose setValues).
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .forEach(([name, value], i) => setTimeout(() => {
        try { fa.setValues({ [name]: value }); markFilled([name]); } catch { /* form unmounted */ }
      }, i * FIELD_STAGGER_MS));
  }, []);

  // ── AG-UI event -> store dispatcher (Phase 8) ──────────────────────────────
  const dispatch = useCallback((evt) => {
    listenersRef.current.forEach((fn) => { try { fn(evt); } catch { /* isolate */ } });
    const s = useMessageStore.getState();
    switch (evt.type) {
      case AguiEvent.RUN_STARTED: s.beginDraft(uid('a')); break;
      case AguiEvent.TEXT_MESSAGE_CONTENT: s.appendText(evt.delta || ''); break;
      case AguiEvent.TOOL_CALL_START: s.startTool(evt.toolCallId, evt.toolCallName); break;
      case AguiEvent.TOOL_CALL_RESULT: s.endTool(evt.toolCallId, evt.content); break;
      case AguiEvent.CUSTOM:
        if (evt.name === CustomPayload.PREFILL) { s.setPrefill(evt.value); autoApply(evt.value); }
        else if (evt.name === CustomPayload.SUGGESTIONS) s.setSuggestions(evt.value || []);
        else if (evt.name === CustomPayload.VALIDATION) s.setValidation(evt.value);
        break;
      case AguiEvent.RUN_ERROR: s.setError(evt.message || 'The assistant hit an error.'); s.abandonDraft(true); break;
      case AguiEvent.RUN_FINISHED: s.commitDraft(); break;
      default: break;
    }
  }, [autoApply]);

  // ── session bootstrap / resume (Phase 4) ───────────────────────────────────
  const ensureThread = useCallback(async () => {
    const { threadId, setThread } = useSessionStore.getState();
    if (threadId) return threadId;
    const session = await agentApi.createSession(buildPage());
    setThread(session.threadId, useAuthStore.getState().user?.id || 'me');
    return session.threadId;
  }, [buildPage]);

  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;
    (async () => {
      agentApi.status().then((st) => !cancelled && useSessionStore.getState().setUpstream(st.upstream)).catch(() => {});
      try {
        const { threadId } = useSessionStore.getState();
        if (threadId) {
          const hist = await agentApi.getHistory(threadId);
          if (!cancelled) useMessageStore.getState().loadHistory(hist.messages);
        }
      } catch {
        useSessionStore.getState().clear();
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  // ── core run (Phase 2/3) ────────────────────────────────────────────────────
  const run = useCallback(async ({ text = '', trigger = AgentTrigger.USER_MESSAGE }) => {
    const store = useMessageStore.getState();
    if (['connecting', 'thinking', 'streaming'].includes(store.status)) return; // one run at a time
    const threadId = await ensureThread();

    if (trigger === AgentTrigger.USER_MESSAGE && text.trim()) {
      store.addUserMessage({ id: uid('u'), role: 'user', content: text.trim() });
    }
    store.setStatus('connecting');
    lastRunRef.current = { text, trigger };

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamChat({ threadId, message: text, page: buildPage(), trigger }, { signal: ac.signal, onEvent: dispatch });
      if (useMessageStore.getState().draft) useMessageStore.getState().commitDraft();
    } catch (err) {
      if (err?.name === 'AbortError') { useMessageStore.getState().abandonDraft(false); return; }
      useMessageStore.getState().setError(err.message || 'Connection lost.');
      useMessageStore.getState().abandonDraft(true);
    }
  }, [ensureThread, buildPage, dispatch]);

  // ── public actions (stable) ─────────────────────────────────────────────────
  const send = useCallback((text) => run({ text, trigger: AgentTrigger.USER_MESSAGE }), [run]);
  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const retryLast = useCallback(() => { if (lastRunRef.current) run(lastRunRef.current); }, [run]);
  const notifyPageContext = useCallback(() => run({ trigger: AgentTrigger.PAGE_CONTEXT }), [run]);
  const checkForm = useCallback(() => run({ trigger: AgentTrigger.FIELD_CHANGED }), [run]);

  const reset = useCallback(async () => {
    cancel();
    const { threadId } = useSessionStore.getState();
    useMessageStore.getState().resetConversation();
    try { if (threadId) await agentApi.reset(threadId); } catch { /* best effort */ }
  }, [cancel]);

  /** Manual apply (used when auto-fill is OFF): fill the form, persist, ask for next steps. */
  const applyPrefill = useCallback(async (values) => {
    const fa = useAssistantStore.getState().formApi;
    if (fa && values) {
      lastAppliedRef.current = Object.keys(values);
      if (fa.autoFillSequential) await fa.autoFillSequential(values); // animated, section-by-section
      else { fa.setValues(values); usePrefsStore.getState().markFilled(Object.keys(values)); }
    }
    const { threadId } = useSessionStore.getState();
    if (threadId) { try { await agentApi.syncForm(threadId, values || {}, buildPage()); } catch { /* noop */ } }
    run({ trigger: AgentTrigger.PREFILL_APPLIED });
  }, [run, buildPage]);

  const dismissPrefill = useCallback(() => run({ trigger: AgentTrigger.PREFILL_DISMISSED }), [run]);

  /** Undo the agent's last auto-fill by clearing exactly the fields it wrote. */
  const undoLastFill = useCallback(() => {
    const fa = useAssistantStore.getState().formApi;
    const names = lastAppliedRef.current || [];
    if (fa && names.length) fa.setValues(Object.fromEntries(names.map((n) => [n, ''])));
    lastAppliedRef.current = [];
    usePrefsStore.getState().clearFilled();
  }, []);

  /** Persist live form edits into agent context (Phase 6 — user edit -> agent). */
  const syncForm = useCallback(async (formValues) => {
    const { threadId } = useSessionStore.getState();
    if (!threadId) return;
    try { await agentApi.syncForm(threadId, formValues || {}, buildPage()); } catch { /* best effort */ }
  }, [buildPage]);

  const value = useMemo(
    () => ({
      send, cancel, reset, retryLast, notifyPageContext, checkForm,
      applyPrefill, dismissPrefill, undoLastFill, syncForm, buildPage, subscribe,
    }),
    [send, cancel, reset, retryLast, notifyPageContext, checkForm, applyPrefill, dismissPrefill, undoLastFill, syncForm, buildPage, subscribe],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
