// TypingEngine — orchestrates human-like, keystroke-level form filling. Reusable across every
// form: it locates fields generically by their `name` attribute (no hardcoded selectors/names),
// classifies them, and types/selects with natural pacing. Composes:
//   • FieldNavigator   — find + classify a field's real DOM node
//   • FocusManager     — focus/scroll a field like a person moving to it
//   • Scheduler        — variable speed + word/field/think pauses (+ abortable sleep)
//   • InputEventDispatcher (inputEvents.js) — the real keydown→…→input→keyup lifecycle
//   • TypingController — smart interruption (a real user keystroke/click stops the AI at once)
import {
  typeKeystroke, setValueViaInput, focusField, blurField, setNativeValue,
} from './inputEvents.js';
import { getTypingConfig, COMPLEX_FIELD } from './config.js';

// ── Scheduler ──────────────────────────────────────────────────────────────────
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
    return undefined;
  });
}

// ── FieldNavigator ──────────────────────────────────────────────────────────────
const cssEscape = (s) => (window.CSS?.escape ? window.CSS.escape(String(s)) : String(s).replace(/["\\]/g, '\\$&'));

export function findFieldNode(name, root) {
  const scope = root || document;
  return scope.querySelector(`[name="${cssEscape(name)}"]`);
}

/** What kind of interaction a node needs: 'text' (keystrokes), 'set' (one input event), 'fallback'. */
export function classifyNode(node) {
  if (!node) return 'missing';
  if (node.tagName === 'TEXTAREA') return 'text';
  if (node.tagName === 'INPUT') {
    const t = (node.type || 'text').toLowerCase();
    if (['text', 'tel', 'email', 'number', 'search', 'url', 'password'].includes(t)) return 'text';
    if (['date', 'datetime-local', 'month', 'time', 'week'].includes(t)) return 'set';
    return 'fallback'; // checkbox/radio/hidden (MUI Select) → select via the RHF fallback
  }
  return 'fallback';
}

// ── FocusManager ─────────────────────────────────────────────────────────────────
function moveToField(node) {
  try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* noop */ }
  focusField(node);
}

// ── TypingEngine: fill one field the way a person would ──────────────────────────
/**
 * Fill one field like a person. `commit(name, value)` writes the (cumulative) value to the
 * form's state (React Hook Form / Formik). We call it PER keystroke as well as dispatching the
 * full DOM event lifecycle: the DOM events drive masks/validators/dependent-field listeners,
 * while `commit` guarantees the value actually sticks in a controlled React input (which would
 * otherwise snap back to its bound state). This is the reliable combination for controlled forms.
 * @returns {Promise<'typed'|'set'|'commit'|'missing'>}
 */
export async function typeField({ name, value, root, commit, signal, hooks = {}, config }) {
  const cfg = { ...getTypingConfig(), ...(config || {}) };
  const str = value == null ? '' : String(value);
  const node = findFieldNode(name, root);
  const kind = classifyNode(node);

  // Typing disabled, or a control we can't keystroke (select/checkbox/date/hidden/not-mounted)
  // → commit directly (the sanctioned fallback).
  if (!cfg.enableHumanTyping || cfg.enableInstantFill || kind === 'missing' || kind === 'fallback') {
    hooks.onField?.({ name, kind: 'commit' });
    commit?.(name, value);
    hooks.onFieldDone?.({ name });
    return kind === 'missing' ? 'missing' : 'commit';
  }

  // A short "thinking" pause before complex info (a person recalling an ID / date).
  if (COMPLEX_FIELD.test(name)) {
    hooks.onThink?.({ name });
    await sleep(cfg.thinkPause, signal);
  }

  hooks.onField?.({ name, kind });
  moveToField(node);
  await sleep(rand(cfg.fieldFocusMin, cfg.fieldFocusMax), signal); // settle after focusing

  if (kind === 'set' || str.length > cfg.maxTypeLength) {
    setValueViaInput(node, str);
    commit?.(name, str);
  } else {
    let acc = '';
    for (const ch of str) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      acc += ch;
      typeKeystroke(node, ch, acc); // keydown → keypress → beforeinput → input → keyup
      commit?.(name, acc);          // guarantee the controlled input keeps the value
      hooks.onChar?.({ name, value: acc });
      // eslint-disable-next-line no-await-in-loop
      await sleep(rand(cfg.charDelayMin, cfg.charDelayMax) + (ch === ' ' ? cfg.wordPause : 0), signal);
    }
  }
  blurField(node); // fire onBlur/validation, like leaving the field
  hooks.onFieldDone?.({ name });
  return kind === 'set' ? 'set' : 'typed';
}

// ── TypingController: run lifecycle + smart interruption ─────────────────────────
// A genuine user keystroke or a click into a form control immediately aborts the run and
// hands control back — engine-dispatched events are untrusted (isTrusted === false), so the
// engine never aborts itself.
export class TypingController {
  constructor() {
    this._ac = null;
    this._onUser = null;
    this.interrupted = false;
  }

  get signal() { return this._ac?.signal; }
  get aborted() { return !!this._ac?.signal.aborted; }

  begin() {
    this._ac = new AbortController();
    this.interrupted = false;
    this._onUser = (e) => {
      if (!e.isTrusted) return; // ignore the engine's own synthetic events
      if (e.type === 'keydown' || e.target?.closest?.('input, textarea, select, [role="combobox"]')) {
        this.interrupted = true;
        this._ac.abort();
      }
    };
    document.addEventListener('keydown', this._onUser, true);
    document.addEventListener('pointerdown', this._onUser, true);
    return this._ac.signal;
  }

  abort() { this._ac?.abort(); }

  end() {
    if (this._onUser) {
      document.removeEventListener('keydown', this._onUser, true);
      document.removeEventListener('pointerdown', this._onUser, true);
      this._onUser = null;
    }
  }
}

export { sleep, rand, setNativeValue };
