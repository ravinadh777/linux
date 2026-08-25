import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Server-side draft autosave + resume for an application form.
//
// WHY SERVER-SIDE AND NOT localStorage. localStorage would survive a refresh, but
// not a sign-out, not a different device, and not a cleared browser. The failure
// this exists to prevent is the 15-minute access-token expiry logging a citizen out
// mid-form, and on the shared/public machines many citizens use, a local-only draft
// is both useless (gone after logout) and a privacy problem (left behind for the
// next user). The draft lives in `application_drafts`, keyed to the citizen.
//
// ── The three things this hook has to get right ────────────────────────────────
//
// 1. DEBOUNCE, and never lose the last edit. Saving on every keystroke would be one
//    request per character. Saving on a debounce alone risks dropping whatever was
//    typed in the final window before the page unloads — so the debounce is paired
//    with a `flush()` that ApplyPage calls on unmount and on `pagehide`.
//
// 2. NEVER SAVE OVER GOOD DATA WITH EMPTY DATA. This is the subtle one. On mount the
//    form is empty, and the effects that watch form values fire immediately. Without
//    a guard the first autosave would PUT `{}` over a perfectly good stored draft and
//    destroy exactly what we are trying to protect. `restoredRef` gates all saving
//    until the initial load has completed, and `hasContent()` refuses to persist a
//    payload with nothing in it.
//
// 3. DO NOT FIGHT THE RESTORE. Restoring writes values into the form, which triggers
//    the watcher, which would immediately save them straight back. Harmless but
//    wasteful, and it muddies `lastSavedAt`. `suppressRef` swallows the echo.
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 1200;

/** True if this payload contains anything worth persisting. */
function hasContent({ form, documents }) {
  const formFilled = Object.values(form || {}).some((v) => (
    Array.isArray(v) ? v.length > 0 : v !== '' && v !== null && v !== undefined && v !== false
  ));
  return formFilled || Object.keys(documents || {}).length > 0;
}

/**
 * ── PLUGGABLE TRANSPORT ───────────────────────────────────────────────────────
 * Every debounce, guard and restore rule below is transport-agnostic; only the three
 * calls that actually move bytes are injectable. That is what lets the MOHA Tint
 * Waiver services store their drafts in the MOHA Applicant API instead of this
 * portal's `application_drafts` table, while reusing this hook's hard-won behaviour
 * (never-save-empty-over-good, single-flight, pagehide flush) rather than
 * reimplementing it and getting one of them subtly wrong.
 *
 * The default transport is the portal one, so all twelve existing services are
 * byte-for-byte unchanged.
 *
 * @param {string} serviceId
 * @param {{ enabled?: boolean, transport?: {load:Function, save:Function, remove:Function} }} [opts]
 */
// MUST be a stable reference. It is in the dependency arrays of the load effect and
// the save/discard callbacks, so an inline object literal would change identity every
// render and re-trigger the initial load in a loop. Both shipped transports are
// module-level constants, which is what makes that safe.
export const portalDraftTransport = {
  load: (serviceId) => api.get(`/applications/drafts/${encodeURIComponent(serviceId)}`).then((r) => r.data?.draft || null),
  save: (serviceId, payload) => api.put(`/applications/drafts/${encodeURIComponent(serviceId)}`, payload).then((r) => r.data),
  remove: (serviceId) => api.delete(`/applications/drafts/${encodeURIComponent(serviceId)}`).then(() => true),
};

export function useApplicationDraft(serviceId, { enabled = true, transport = portalDraftTransport } = {}) {
  // 'loading' → fetching any stored draft; 'idle' → nothing pending;
  // 'saving' → a PUT is in flight; 'saved' → persisted; 'error' → last save failed.
  const [status, setStatus] = useState('loading');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [restored, setRestored] = useState(null); // the draft we loaded, once
  const [loadError, setLoadError] = useState(null);

  const timerRef = useRef(null);
  const pendingRef = useRef(null);   // newest un-saved payload
  const restoredRef = useRef(false); // has the initial load finished?
  const suppressRef = useRef(false); // ignore the echo from restoring
  const inFlightRef = useRef(false);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !serviceId) { setStatus('idle'); restoredRef.current = true; return undefined; }
    let cancelled = false;
    restoredRef.current = false;
    setStatus('loading');
    setRestored(null);
    setLoadError(null);

    Promise.resolve(transport.load(serviceId))
      .then((loaded) => {
        if (cancelled) return;
        const draft = loaded || null;
        if (draft && hasContent(draft)) {
          suppressRef.current = true;
          setRestored(draft);
          setLastSavedAt(draft.lastSavedAt || null);
        }
        setStatus('idle');
      })
      .catch((err) => {
        if (cancelled) return;
        // A failed LOAD must not block the citizen from filling the form — it just
        // means we start blank. Surfaced so the UI can say "could not check for a
        // saved draft" rather than silently pretending there was none.
        setLoadError(err);
        setStatus('idle');
      })
      .finally(() => { if (!cancelled) restoredRef.current = true; });

    return () => { cancelled = true; };
  }, [serviceId, enabled, transport]);

  /** Persist immediately. Resolves true on success. */
  const put = useCallback(async (payload) => {
    if (!enabled || !serviceId) return false;
    inFlightRef.current = true;
    setStatus('saving');
    try {
      const data = await transport.save(serviceId, payload);
      setLastSavedAt(data?.lastSavedAt || new Date().toISOString());
      setStatus('saved');
      return true;
    } catch {
      // Deliberately NOT a toast. Autosave runs continuously, and a network blip
      // would otherwise spam the citizen with failures for something they did not
      // ask for. The status chip shows "not saved" and the next debounce retries.
      setStatus('error');
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [serviceId, enabled, transport]);

  /**
   * Queue a debounced save. Call freely — on every value change.
   * @param {{form: object, documents: object, activeStep: number}} payload
   */
  const queueSave = useCallback((payload) => {
    if (!enabled || !serviceId) return;
    if (!restoredRef.current) return;        // guard 2: never overwrite before load
    if (suppressRef.current) { suppressRef.current = false; return; } // guard 3
    if (!hasContent(payload)) return;        // guard 2: never persist an empty form

    pendingRef.current = payload;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) put(next);
    }, DEBOUNCE_MS);
  }, [put, serviceId, enabled]);

  /** Write any pending edit out NOW. Used on unmount / navigation / tab close. */
  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) return put(next);
    return false;
  }, [put]);

  /** Explicit "Save" button — bypasses the debounce and reports success/failure. */
  const saveNow = useCallback(async (payload) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = null;
    return put(payload);
  }, [put]);

  /** Forget the stored draft (after a successful submit, or an explicit discard). */
  const discard = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = null;
    try {
      await transport.remove(serviceId);
    } catch {
      /* already gone, or never existed — nothing to do */
    }
    setLastSavedAt(null);
    setStatus('idle');
  }, [serviceId, transport]);

  /**
   * Stop autosaving. Called immediately before submit so the debounce cannot fire a
   * PUT that recreates the draft AFTER the server has retired it — which would leave
   * the citizen with a phantom draft for an application they just submitted.
   */
  const disable = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = null;
    restoredRef.current = false;
  }, []);

  // Last-chance save when the tab is hidden or closed. `pagehide` + `visibilitychange`
  // rather than `beforeunload`: mobile Safari and Chrome for Android frequently never
  // fire `beforeunload`, and those are the browsers most likely to background the tab
  // and kill it. This is the belt to the debounce's braces.
  useEffect(() => {
    if (!enabled) return undefined;
    const onHide = () => { if (pendingRef.current && !inFlightRef.current) flush(); };
    const onVis = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [flush, enabled]);

  return { status, lastSavedAt, restored, loadError, queueSave, saveNow, flush, discard, disable };
}
