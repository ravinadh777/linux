import { Dialog } from '@mui/material';
import { Button } from '../../ui/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shown ONLY when the silent refresh in useSessionKeepAlive has already failed and
// the token is inside its last two minutes. In normal operation the citizen never
// sees this: the token is replaced at 75% of its life with no interruption.
//
// The copy does one job above all others — say plainly that nothing has been lost.
// The reason a timeout warning is frightening on a government form is the fear of
// losing an hour of typing, and since ApplyPage now autosaves to a server-side
// draft, that fear is unfounded and we should say so explicitly.
//
// MUI Dialog is retained here for exactly the reason the rest of the app keeps it:
// the focus trap and aria-modal wiring. A timeout warning that a screen-reader user
// cannot find is worse than none.
// ─────────────────────────────────────────────────────────────────────────────

const mmss = (total) => {
  const s = Math.max(0, total || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function SessionExpiryDialog({ secondsLeft, onExtend, onSignOut }) {
  const open = secondsLeft !== null && secondsLeft !== undefined;
  return (
    <Dialog
      open={!!open}
      // Not dismissible by backdrop click or Escape: this needs a decision, and an
      // accidental dismiss would put the citizen back to being silently logged out.
      disableEscapeKeyDown
      aria-labelledby="session-expiry-title"
      aria-describedby="session-expiry-body"
      maxWidth="xs"
      fullWidth
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <span aria-hidden className="shrink-0 w-11 h-11 rounded-full bg-warn-tint text-warn-text grid place-items-center">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5l3 2" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="session-expiry-title" className="text-card-title font-bold text-ink dark:text-d-ink">
              Your session is about to end
            </h2>
            <p id="session-expiry-body" className="text-sm text-muted dark:text-d-muted mt-1.5">
              For your security we sign you out after a period of inactivity. You have{' '}
              {/* aria-live so a screen reader announces the countdown without the
                  user having to hunt for it; `tabular-nums` stops the digits jittering. */}
              <strong className="text-ink dark:text-d-ink tabular-nums" aria-live="polite">
                {mmss(secondsLeft)}
              </strong>{' '}
              left.
            </p>
            {/* The reassurance is the most important sentence in this dialog. */}
            <p className="text-sm mt-2.5 rounded-btn px-3 py-2.5 oc-glass-sunken">
              <strong>Nothing you have typed will be lost.</strong> Any application you are
              part-way through is saved automatically, and you will come straight back to it
              when you sign in again.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5 sm:justify-end">
          <Button variant="secondary" onClick={onSignOut}>Sign out now</Button>
          {/* No `autoFocus`. MUI's Dialog already moves focus into the dialog and traps
              it there, so the prop was redundant — and jsx-a11y/no-autofocus flags it
              because a stolen focus is disorienting for screen-reader and
              switch-device users. The focus trap gives the same outcome safely. */}
          <Button onClick={onExtend}>Stay signed in</Button>
        </div>
      </div>
    </Dialog>
  );
}
