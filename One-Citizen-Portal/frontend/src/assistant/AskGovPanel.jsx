import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAssistantStore } from '../stores/assistantStore.js';
import { cx, Chip, Button } from '../ui/index.js';
import {
  useAgentStream, useAutoFill, AgentErrorBoundary, TOOL_LABELS,
  buildGuide, mergeSuggestions, useExecutionStore, ExecStatus,
} from '../agent/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// AskGov panel — rebuilt in Tailwind on the prototype's green/gold language.
//
// BEHAVIOUR IS UNCHANGED. Every hook, handler and prop is the same: useAgentStream,
// useAutoFill, the execution store, the proactive page-context offer, prefill
// apply/dismiss/undo, cancel, reset, retry and the AG-UI event grammar. Only markup
// and classes changed.
//
// Layout notes, since the old panel felt loose and misaligned:
//   • ONE content inset (px-3.5) shared by the header, messages, chips and composer,
//     so every element sits on the same vertical line. The old panel mixed px-2 and
//     mx-2 and the execution card was inset differently from the messages above it.
//   • Bubbles are 88% max width with a flat corner on the sender's side, so the
//     conversation reads as a thread rather than a stack of boxes.
//   • The composer is pinned, compact, and grows to 5 rows — no fixed 6-unit radius
//     pill that swallowed the send button.
//   • Vertical rhythm is 12px between turns, 6px inside a turn.
// ─────────────────────────────────────────────────────────────────────────────

const EXEC_LABEL = {
  reviewing: 'Reviewing your application',
  section: 'Opening section',
  typing: 'Filling the form',
  thinking: 'Thinking',
  waiting: 'Waiting for you',
  completed: 'Completed',
  stopped: 'Paused',
};

const INSET = 'px-3.5';

// ── Small parts ──────────────────────────────────────────────────────────────

function Sparkle({ size = 15 }) {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width={size} height={size} fill="currentColor">
      <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5z" />
    </svg>
  );
}

/** The assistant's avatar, used beside every non-user turn. */
function Bot({ size = 26 }) {
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full grid place-items-center text-white bg-gradient-to-br from-primary-deep to-primary"
      style={{ width: size, height: size }}
    >
      <Sparkle size={size * 0.55} />
    </span>
  );
}

/** Blinking caret at the end of a streaming message. */
function Caret() {
  return <span aria-hidden className="inline-block w-[2px] h-[1em] ml-0.5 -mb-0.5 bg-current animate-pulse" />;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-2.5 rounded-tile rounded-tl-[4px] bg-card dark:bg-d-card border border-line dark:border-d-line">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="w-1.5 h-1.5 rounded-full bg-muted dark:bg-d-muted oc-typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

/** Live tool trace above an assistant turn. */
function ToolTrace({ toolCalls }) {
  if (!toolCalls?.length) return null;
  return (
    <ul className="list-none m-0 p-0 mb-1.5 flex flex-col gap-1">
      {toolCalls.map((t) => (
        <li key={t.id} className="flex items-center gap-1.5 text-micro text-muted dark:text-d-muted">
          {t.done ? (
            <span aria-hidden className="text-primary dark:text-d-primary shrink-0"><Sparkle size={12} /></span>
          ) : (
            <span aria-hidden className="w-3 h-3 shrink-0 rounded-full border-2 border-line border-t-primary animate-spin" />
          )}
          <span className="truncate">{TOOL_LABELS[t.name] || t.name}{t.done ? '' : '…'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Live progress while the agent drives a form. */
function ExecutionPanel() {
  const active = useExecutionStore((s) => s.active);
  const status = useExecutionStore((s) => s.status);
  const sectionIndex = useExecutionStore((s) => s.sectionIndex);
  const sectionCount = useExecutionStore((s) => s.sectionCount);
  const completed = useExecutionStore((s) => s.completedCount);
  const remaining = useExecutionStore((s) => s.remainingCount);
  const waitingFor = useExecutionStore((s) => s.waitingFor);
  const narration = useExecutionStore((s) => s.narration);
  if (!active) return null;

  const total = completed + remaining;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const dot = status === ExecStatus.WAITING ? 'bg-warn'
    : status === ExecStatus.COMPLETED ? 'bg-primary'
    : status === ExecStatus.STOPPED ? 'bg-muted' : 'bg-primary';
  const animate = status !== ExecStatus.COMPLETED && status !== ExecStatus.STOPPED;

  return (
    <div className={cx(INSET, 'pb-2.5 shrink-0')} aria-live="polite">
      <div className="rounded-tile border border-line dark:border-d-line bg-card dark:bg-d-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <span aria-hidden className={cx('w-2 h-2 rounded-full shrink-0', dot, animate && 'animate-pulse')} />
          <p className="text-micro font-bold truncate">{EXEC_LABEL[status] || 'Working'}</p>
          {sectionCount > 0 && (
            <p className="ml-auto text-micro text-muted dark:text-d-muted shrink-0 tabular-nums">
              {Math.min(sectionIndex + 1, sectionCount)}/{sectionCount}
            </p>
          )}
        </div>

        <div className="h-1.5 rounded-pill bg-tint dark:bg-d-tint overflow-hidden">
          <div
            className="h-full rounded-pill bg-primary dark:bg-d-primary transition-all duration-slow ease-standard"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {narration && <p className="text-sm mt-2 leading-snug">{narration}</p>}

        {waitingFor.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {waitingFor.map((w) => <Chip key={w.name} tone="warn" dot={false}>{w.label}</Chip>)}
          </div>
        )}

        <div className="flex gap-4 mt-2 text-micro text-muted dark:text-d-muted tabular-nums">
          <span>Done <b className="text-ink dark:text-d-ink">{completed}</b></span>
          <span>Left <b className="text-ink dark:text-d-ink">{remaining}</b></span>
        </div>
      </div>
    </div>
  );
}

/** Values the agent proposes for the current form. */
function PrefillCard({ prefill, autoFill, canApply, onApply, onDismiss, onUndo }) {
  const fields = prefill?.fields || [];
  if (!fields.length) return null;
  const req = (prefill.remaining || []).filter((r) => r.required).map((r) => r.label);
  const docs = (prefill.documents || []).map((d) => d.label);
  const autoApplied = autoFill && canApply;

  return (
    <div className={cx(
      'mt-1.5 rounded-tile border bg-card dark:bg-d-card p-3',
      autoApplied ? 'border-primary dark:border-d-primary' : 'border-line dark:border-d-line',
    )}>
      <p className={cx(
        'flex items-center gap-1.5 text-micro font-bold mb-2',
        autoApplied ? 'text-primary dark:text-d-primary' : 'text-gold-text',
      )}>
        <Sparkle size={13} />
        {autoApplied
          ? `Filled in ${fields.length} field${fields.length === 1 ? '' : 's'} — check them`
          : 'Proposed from your records'}
      </p>

      <dl className="m-0 flex flex-col gap-1.5">
        {fields.map((f) => (
          <div key={f.name} className="flex items-baseline justify-between gap-3 min-w-0">
            <dt className="text-sm font-semibold min-w-0 shrink">{f.label}</dt>
            <dd className="m-0 text-sm text-right text-muted dark:text-d-muted min-w-0 break-words">
              {String(f.value)}
              <span className="block text-micro opacity-70">{f.source}</span>
            </dd>
          </div>
        ))}
      </dl>

      {(req.length > 0 || docs.length > 0) && (
        <p className="text-micro text-muted dark:text-d-muted mt-2 pt-2 border-t border-line dark:border-d-line">
          {req.length > 0 && <>Still needed: {req.join(', ')}. </>}
          {docs.length > 0 && <>Upload: {docs.join(', ')}.</>}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-2.5">
        {autoApplied ? (
          <Button size="sm" variant="secondary" onClick={onUndo}>Undo</Button>
        ) : (
          <>
            <Button size="sm" disabled={!canApply} onClick={() => onApply(prefill.values)}>Apply to form</Button>
            <Button size="sm" variant="secondary" onClick={onDismiss}>Not now</Button>
          </>
        )}
      </div>

      {!canApply && (
        <p className="text-micro text-muted dark:text-d-muted mt-1.5">
          Open the application form to apply these.
        </p>
      )}
    </div>
  );
}

function MessageBubble({ m, autoFill, canApply, onApply, onDismiss, onUndo, streaming }) {
  const mine = m.role === 'user';
  return (
    <div className={cx('flex items-start gap-2', mine ? 'justify-end' : 'justify-start')}>
      {!mine && <Bot />}
      <div className={cx('min-w-0', mine ? 'max-w-[86%]' : 'max-w-[88%]')}>
        {!mine && <ToolTrace toolCalls={m.toolCalls} />}
        {(m.content || mine) && (
          <div className={cx(
            'px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-tile',
            mine
              // Flat corner on the sender's side — the cue that makes a thread read
              // as a conversation rather than a column of identical boxes.
              ? 'bg-primary text-white rounded-tr-[4px]'
              : 'bg-card dark:bg-d-card border border-line dark:border-d-line rounded-tl-[4px]',
          )}>
            {m.content}{streaming && <Caret />}
          </div>
        )}
        {!mine && m.prefill && (
          <PrefillCard prefill={m.prefill} autoFill={autoFill} canApply={canApply}
            onApply={onApply} onDismiss={onDismiss} onUndo={onUndo} />
        )}
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

function PanelBody({ onClose }) {
  const {
    messages, draft, status, error, suggestions, busy, upstream,
    send, cancel, reset, retryLast, applyPrefill, dismissPrefill, undoLastFill, notifyPageContext,
  } = useAgentStream();
  const autoFill = useAutoFill();
  const formApi = useAssistantStore((s) => s.formApi);
  const formProgress = useAssistantStore((s) => s.formProgress);
  const location = useLocation();
  const guide = buildGuide({ route: location.pathname, progress: formProgress });
  const displayChips = mergeSuggestions(suggestions, guide.chips);
  const execActive = useExecutionStore((s) => s.active);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const offeredFor = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, draft, status]);

  // Proactive auto-fill offer on an empty application form (AG-UI page_context).
  useEffect(() => {
    const sid = formApi?.serviceId;
    if (!sid || busy) return;
    const empty = messages.length === 0 && !draft;
    const values = formApi.getSnapshot?.() || {};
    const formEmpty = !Object.values(values).some((v) => v && (!Array.isArray(v) || v.length));
    if (empty && formEmpty && offeredFor.current !== sid) {
      offeredFor.current = sid;
      notifyPageContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formApi?.serviceId, messages.length]);

  const doSend = (raw) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    send(text);
  };

  const canApply = !!formApi;
  const showTyping = status === 'connecting' || status === 'thinking';
  const online = upstream === 'ok';

  return (
    <div className="flex flex-col h-full bg-page dark:bg-d-page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className={cx(
        'relative shrink-0 py-3 text-white overflow-hidden',
        'bg-gradient-to-br from-primary-deep to-primary', INSET,
      )}>
        <span aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(340px circle at 88% -30%, rgba(255,255,255,.16), transparent 60%)' }} />

        <div className="relative flex items-center gap-2.5">
          <span className="relative shrink-0">
            <span aria-hidden className="w-9 h-9 rounded-full bg-white/20 grid place-items-center backdrop-blur-sm">
              <Sparkle size={17} />
            </span>
            <span
              aria-hidden
              className={cx(
                'absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-primary-deep',
                online ? 'bg-[#4ADE80]' : 'bg-gold',
              )}
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight">AskGov</p>
            <p className="text-micro text-white/85 leading-tight">
              {online ? 'Online' : upstream === 'unavailable' ? 'Reconnecting…' : 'Offline'}
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={reset} aria-label="Start a new chat" title="New chat"
              className="w-9 h-9 grid place-items-center rounded-full text-white hover:bg-white/20 transition-colors duration-fast ease-standard">
              <svg aria-hidden viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M15 9a6 6 0 1 1-1.8-4.3M15 3v3h-3" />
              </svg>
            </button>
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Close the assistant" title="Close"
                className="w-9 h-9 grid place-items-center rounded-full text-white hover:bg-white/20 transition-colors duration-fast ease-standard">
                <svg aria-hidden viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {formApi?.serviceName && (
          <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-pill bg-white/20 px-2.5 py-1 text-micro font-semibold max-w-full">
            <Sparkle size={12} />
            <span className="truncate">Helping with {formApi.serviceName}</span>
          </p>
        )}
      </header>

      {/* ── Messages — the panel's single scroller ──────────────────────────── */}
      <div
        // `overscroll-contain` keeps the wheel inside the transcript — reaching the top
        // or bottom no longer scrolls the page behind the panel.
        className={cx('oc-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain py-3.5', INSET)}
        style={{ overscrollBehavior: 'contain' }}
        aria-live="polite"
      >
        <div className="flex flex-col gap-3">
          {messages.length === 0 && !draft && (
            <div className="flex items-start gap-2">
              <Bot />
              <div className="max-w-[88%] px-3 py-2 rounded-tile rounded-tl-[4px] bg-card dark:bg-d-card border border-line dark:border-d-line">
                <p className="text-sm leading-relaxed">
                  Hi, I&apos;m AskGov. I can fill in an application from your records, explain which
                  documents you need, and look up fees and processing times.
                </p>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} m={m} autoFill={autoFill} canApply={canApply}
              onApply={applyPrefill} onDismiss={dismissPrefill} onUndo={undoLastFill} />
          ))}

          {draft && (draft.content || draft.toolCalls.length > 0 || draft.prefill) && (
            <MessageBubble m={draft} autoFill={autoFill} canApply={canApply}
              onApply={applyPrefill} onDismiss={dismissPrefill} onUndo={undoLastFill}
              streaming={status === 'streaming'} />
          )}

          {showTyping && (
            <div className="flex items-start gap-2">
              <Bot />
              <TypingDots />
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-tile bg-warn-tint text-warn-text p-3">
              <p className="text-sm">{error}</p>
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={retryLast}>Try again</Button>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* ── Live form progress ─────────────────────────────────────────────── */}
      <ExecutionPanel />

      {/* ── Guidance + suggestion chips ────────────────────────────────────── */}
      {!busy && !execActive && (guide.headline || displayChips.length > 0) && (
        <div className={cx(INSET, 'pb-2.5 shrink-0')}>
          {guide.headline && (
            <p className="flex items-center gap-1.5 text-micro font-bold text-muted dark:text-d-muted mb-1.5">
              <span aria-hidden className="text-gold-text shrink-0"><Sparkle size={12} /></span>
              <span className="truncate">{guide.headline}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {displayChips.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => doSend(s)}
                className="rounded-pill border border-line dark:border-d-line bg-card dark:bg-d-card
                           px-2.5 py-1.5 text-micro font-semibold text-left
                           hover:border-primary hover:text-primary hover:bg-tint
                           dark:hover:border-d-primary dark:hover:text-d-primary dark:hover:bg-d-tint
                           transition-colors duration-fast ease-standard"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Composer ───────────────────────────────────────────────────────── */}
      <div className={cx('shrink-0 border-t border-line dark:border-d-line bg-card dark:bg-d-card py-2.5', INSET)}>
        <div className="flex items-end gap-1.5 rounded-tile border border-line dark:border-d-line
                        bg-page dark:bg-d-page pl-3 pr-1.5 py-1.5
                        focus-within:border-primary dark:focus-within:border-d-primary
                        transition-colors duration-fast ease-standard">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } }}
            placeholder={formApi ? 'Tell me your details, or “fill this from my records”' : 'Ask AskGov anything'}
            aria-label="Message AskGov"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none resize-none
                       text-sm leading-relaxed py-1 max-h-[120px] oc-scroll
                       placeholder:text-muted dark:placeholder:text-d-muted placeholder:opacity-80"
            style={{ height: 'auto' }}
            onInput={(e) => {
              // Grow with content up to the max-height, then scroll.
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
          />
          {busy ? (
            <button type="button" onClick={cancel} aria-label="Stop generating" title="Stop"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-btn bg-danger text-white hover:brightness-95 transition-all duration-fast ease-standard">
              <svg aria-hidden viewBox="0 0 18 18" width="15" height="15" fill="currentColor"><rect x="5" y="5" width="8" height="8" rx="1.5" /></svg>
            </button>
          ) : (
            <button type="button" onClick={() => doSend()} disabled={!input.trim()} aria-label="Send message" title="Send"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-btn text-white
                         bg-primary hover:bg-primary-dark
                         disabled:bg-tint disabled:text-muted disabled:cursor-not-allowed
                         dark:disabled:bg-d-tint dark:disabled:text-d-muted
                         transition-colors duration-fast ease-standard">
              <svg aria-hidden viewBox="0 0 18 18" width="16" height="16" fill="currentColor">
                <path d="M2.5 15.5L16 9 2.5 2.5 2.5 7.5 11 9l-8.5 1.5z" />
              </svg>
            </button>
          )}
        </div>

        <p className="text-micro text-muted dark:text-d-muted text-center mt-2">
          AskGov proposes — you review and confirm. It never submits for you.
        </p>
      </div>
    </div>
  );
}

export default function AskGovPanel({ onClose }) {
  return (
    <AgentErrorBoundary onClose={onClose}>
      <PanelBody onClose={onClose} />
    </AgentErrorBoundary>
  );
}
