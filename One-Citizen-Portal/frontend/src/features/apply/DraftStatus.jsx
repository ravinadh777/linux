// ─────────────────────────────────────────────────────────────────────────────
// The autosave indicator.
//
// This exists to answer one anxious question — "is my work safe?" — without the
// citizen having to wonder. It is intentionally quiet: no toast, no animation that
// pulls the eye off the form, just a small honest statement of state that they can
// glance at.
//
// `aria-live="polite"` so a screen-reader user gets the same reassurance; polite
// rather than assertive because this must never interrupt someone mid-field.
// ─────────────────────────────────────────────────────────────────────────────

const relative = (iso) => {
  if (!iso) return null;
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(secs)) return null;
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Dot = ({ className }) => <span aria-hidden className={`w-[7px] h-[7px] rounded-full shrink-0 ${className}`} />;

const Spinner = () => (
  <span aria-hidden className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
);

export default function DraftStatus({ status, lastSavedAt, className = '' }) {
  // Each state carries a WORD as well as a colour — status by colour alone is
  // unreadable for a colour-blind citizen, the same rule the status chips follow.
  const view = {
    loading: { icon: <Spinner />, text: 'Checking for saved progress…', tone: 'text-muted dark:text-d-muted' },
    pending: { icon: <Dot className="bg-warn" />, text: 'Unsaved changes…', tone: 'text-muted dark:text-d-muted' },
    saving: { icon: <Spinner />, text: 'Saving…', tone: 'text-muted dark:text-d-muted' },
    saved: {
      icon: <Dot className="bg-primary" />,
      text: lastSavedAt ? `Progress saved ${relative(lastSavedAt)}` : 'Progress saved',
      tone: 'text-muted dark:text-d-muted',
    },
    error: {
      icon: <Dot className="bg-danger" />,
      text: 'Could not save — we will keep trying',
      tone: 'text-danger-text font-semibold',
    },
    idle: lastSavedAt
      ? { icon: <Dot className="bg-primary" />, text: `Progress saved ${relative(lastSavedAt)}`, tone: 'text-muted dark:text-d-muted' }
      // Nothing typed yet and nothing stored — promise the behaviour rather than
      // reporting a state, so the citizen knows before they start that it is safe.
      // Worded to avoid the literal "Your progress", which is the side rail's
      // heading; two elements matching it made the Apply smoke test ambiguous.
      : { icon: <Dot className="bg-line" />, text: 'Saves automatically as you type', tone: 'text-muted dark:text-d-muted' },
  }[status] || null;

  if (!view) return null;

  return (
    <p className={`flex items-center gap-2 text-micro ${view.tone} ${className}`} aria-live="polite">
      {view.icon}
      <span className="truncate">{view.text}</span>
    </p>
  );
}
