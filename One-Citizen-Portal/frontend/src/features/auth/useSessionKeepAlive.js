import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/authStore.js';
import { refreshSession } from '../../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Proactive session keep-alive.
//
// The reactive 401-then-refresh path in lib/api.js is the safety net. This is the
// primary mechanism: replace the access token BEFORE it expires, so no request ever
// 401s and the citizen is never interrupted while filling a form.
//
// SCHEDULE. Refresh at 75% of the token's remaining life. With the 15-minute
// JWT_ACCESS_TTL that is roughly every 11 minutes, leaving a ~4-minute cushion for a
// slow connection or a laptop that was briefly asleep. The timer is rescheduled from
// the NEW `expiresAt` each time, so it tracks whatever TTL the server actually issued
// rather than assuming 900s.
//
// WHY A `setTimeout` AND A VISIBILITY LISTENER. Browsers throttle (and on mobile,
// suspend) timers in background tabs, so a tab left open for an hour may not have
// fired its refresh. Re-checking on `visibilitychange` and on `online` covers the
// laptop-lid and lost-connection cases that a timer alone silently misses.
//
// WARNING, NOT SILENT DEATH. If refresh fails the session really is over (the
// 7-day refresh token has expired or was revoked). `expiring` then goes true, and
// SessionExpiryDialog explains what happened and confirms that in-progress form data
// is saved — instead of the citizen simply finding themselves on the login page.
// ─────────────────────────────────────────────────────────────────────────────

/** Refresh once the token is this far through its life. */
const REFRESH_AT = 0.75;
/** Never schedule further out than this, so a long TTL still gets periodic checks. */
const MAX_DELAY_MS = 10 * 60 * 1000;
/** Floor, so a nearly-dead token does not spin the timer. */
const MIN_DELAY_MS = 5 * 1000;
/** Warn this long before expiry if we could not refresh. */
const WARN_BEFORE_MS = 2 * 60 * 1000;

export function useSessionKeepAlive() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  // Seconds left when we are in the warning window; null when all is well.
  const [warnSecondsLeft, setWarnSecondsLeft] = useState(null);
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null);

  useEffect(() => {
    if (!accessToken || !expiresAt) {
      setWarnSecondsLeft(null);
      return undefined;
    }

    let cancelled = false;
    const clearTimers = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearInterval(warnTimerRef.current);
      timerRef.current = null;
      warnTimerRef.current = null;
    };

    /** Count down in the warning window so the dialog can show real seconds. */
    const startWarning = () => {
      if (warnTimerRef.current) return;
      const tick = () => {
        const left = Math.max(0, Math.round((useAuthStore.getState().expiresAt - Date.now()) / 1000));
        setWarnSecondsLeft(left);
        if (left <= 0) clearInterval(warnTimerRef.current);
      };
      tick();
      warnTimerRef.current = setInterval(tick, 1000);
    };

    const attempt = async () => {
      if (cancelled) return;
      const token = await refreshSession();
      if (cancelled) return;
      if (token) {
        // Success — the effect re-runs on the new `expiresAt` and reschedules.
        setWarnSecondsLeft(null);
        if (warnTimerRef.current) { clearInterval(warnTimerRef.current); warnTimerRef.current = null; }
        return;
      }
      // Refresh failed. If there is still time on the current token, warn and let
      // the citizen act (the reactive interceptor may yet succeed on a real request).
      // If there is not, api.js has already expired the session.
      const remaining = useAuthStore.getState().expiresAt - Date.now();
      if (remaining > 0 && remaining <= WARN_BEFORE_MS) startWarning();
    };

    const schedule = () => {
      clearTimers();
      if (cancelled) return;
      const remaining = useAuthStore.getState().expiresAt - Date.now();
      if (remaining <= 0) { attempt(); return; }
      const delay = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, remaining * REFRESH_AT));
      timerRef.current = setTimeout(() => { attempt().then(schedule); }, delay);
      if (remaining <= WARN_BEFORE_MS) startWarning();
    };

    schedule();

    // Background tabs get their timers throttled or suspended, so re-check whenever
    // the tab becomes visible again or the network comes back. Without this, a form
    // left open in a background tab is exactly the case that still dies.
    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      const remaining = useAuthStore.getState().expiresAt - Date.now();
      if (remaining < MAX_DELAY_MS) attempt().then(schedule);
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('online', recheck);

    return () => {
      cancelled = true;
      clearTimers();
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('online', recheck);
    };
  }, [accessToken, expiresAt]);

  /** Let the citizen force a refresh from the warning dialog. */
  const extend = async () => {
    const token = await refreshSession();
    if (token) setWarnSecondsLeft(null);
    return !!token;
  };

  return { warnSecondsLeft, extend };
}
