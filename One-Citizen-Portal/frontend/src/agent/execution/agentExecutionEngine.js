// AgentExecutionEngine — a resumable workflow engine for agentic form filling.
//
// It walks a workflow PLAN (sections → fields), not the DOM: it opens a section, waits for it
// to render, types each field the agent knows (via the keystroke Typing Engine), SKIPS fields
// that already have a value (never overwrites), and when a mandatory field is unknown it does
// not stop — it PAUSES and waits. The citizen filling that field (or the agent learning it)
// automatically RESUMES execution from the exact pointer; it never restarts. Section unlock is
// handled by opening the next section and continuing. All progress/status flows to the store.
//
// Collaborators (SOLID): FormNavigator (injected — the only coupling to a concrete form/RHF),
// the Typing Engine (typeField), the workflow plan, and the execution store.
import { typeField } from '../typing/engine.js';
import { getTypingConfig } from '../typing/config.js';
import { isFilled, dataFields } from './plan.js';
import { useExecutionStore, ExecStatus } from './executionStore.js';

const store = () => useExecutionStore.getState();

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('aborted', 'AbortError')); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
}

export class AgentExecutionEngine {
  constructor() {
    this.session = null;   // { values, section, field, completed:Set }
    this.nav = null;       // FormNavigator (freshest closures, set on each start)
    this.running = false;
    this._ac = null;       // run AbortController
    this._pending = null;  // { fields, resolve } while WAITING on the citizen/agent
    this._onUser = null;   // interruption listener
  }

  /**
   * Start or RESUME. Merges any newly-known values into the session and continues from the
   * saved pointer — it never restarts a live/paused session.
   * @param {{ values?: object, navigator: object }} args
   */
  start({ values = {}, navigator }) {
    // The user is in control — the agent only fills on an explicit handToAgent() (button/chat),
    // which the caller performs before calling start(). A stray start() never overrides the user.
    if (store().owner === 'user') return;
    this.nav = navigator;
    if (!this.session) {
      this.session = { values: { ...values }, section: 0, field: 0, completed: new Set() };
    } else {
      this.session.values = { ...this.session.values, ...values };
    }
    this.notifyChange(); // newly-known values may satisfy a pending wait
    if (!this.running) this._run();
  }

  /** Fully stop and forget the session (e.g. the form unmounts). */
  stop() {
    this.running = false;
    this._teardownInterrupt();
    this._ac?.abort();
    this._pending = null;
    this.session = null;
    store().reset();
  }

  /** Called by the form on every value change — powers auto-resume + live progress. */
  notifyChange() {
    if (this.nav) this._recount();
    // Once the user owns the form, the agent never auto-resumes — not even a paused wait it
    // wasn't answering. (The one allowed resume is the user filling the exact field the agent
    // is WAITING on; that path resolves `_pending` below while owner is still 'agent'.)
    if (store().owner === 'user') return;
    if (!this._pending) return;
    const { fields, resolve } = this._pending;
    const ready = fields.every((f) => isFilled(this.nav.getValue(f.name), f.type) || this._hasProposed(f.name));
    if (ready) { this._pending = null; resolve(); }
  }

  _hasProposed(name) {
    const v = this.session?.values?.[name];
    return v !== undefined && v !== null && v !== '';
  }

  _recount() {
    const df = dataFields(this.nav.plan);
    let done = 0;
    df.forEach((f) => { if (isFilled(this.nav.getValue(f.name), f.type)) done += 1; });
    store().update({ completedCount: done, remainingCount: Math.max(0, df.length - done) });
  }

  _wait(fields, signal) {
    return new Promise((resolve, reject) => {
      this._pending = { fields, resolve, reject };
      signal?.addEventListener('abort', () => { this._pending = null; reject(new DOMException('aborted', 'AbortError')); }, { once: true });
    });
  }

  // A genuine user keystroke/click during TYPING hands control back (engine-dispatched events
  // are untrusted → ignored). While WAITING, user input is expected, so it never interrupts.
  _installInterrupt() {
    this._onUser = (e) => {
      if (!e.isTrusted || store().status === ExecStatus.WAITING) return;
      if (e.type === 'keydown' || e.target?.closest?.('input, textarea, select, [role="combobox"]')) {
        store().takeOver(); // owner → 'user' (permanent): the agent won't grab control back
        this._ac?.abort();  // cancel the in-progress keystroke + any queued section fills
      }
    };
    document.addEventListener('keydown', this._onUser, true);
    document.addEventListener('pointerdown', this._onUser, true);
  }

  _teardownInterrupt() {
    if (!this._onUser) return;
    document.removeEventListener('keydown', this._onUser, true);
    document.removeEventListener('pointerdown', this._onUser, true);
    this._onUser = null;
  }

  async _run() {
    this.running = true;
    this._ac = new AbortController();
    const { signal } = this._ac;
    // NOTE: no user-input interrupt. The agent runs to completion — it NEVER overwrites a field
    // that already has a value (every pass checks isFilled first), so the citizen can edit any
    // field at any time without the agent fighting them, and the agent still fills all remaining
    // known fields and asks for the true gaps. (Explicit stop() still cancels everything.)
    const plan = this.nav.plan;
    const cfg = getTypingConfig();

    store().update({
      active: true, status: ExecStatus.REVIEWING, serviceName: this.nav.serviceName,
      sectionCount: plan.length, waitingFor: [], narration: 'Reviewing your application…',
    });
    this._recount();

    try {
      await sleep(450, signal);
      for (let si = this.session.section; si < plan.length; si += 1) {
        this.session.section = si;
        const sec = plan[si];
        await this.nav.ready(si); // open the section + wait for its inputs to render
        store().update({ status: ExecStatus.SECTION, sectionIndex: si, sectionTitle: sec.title, currentField: null, currentLabel: null, narration: `Filling ${sec.title}…` });
        await sleep(cfg.sectionPause, signal);

        // PASS 1 — fill EVERYTHING we already know in this section, in one sweep, regardless of
        // field order, so a known field is NEVER blocked behind an earlier unknown one. This is
        // what populates all of the citizen's profile data up-front. (Docs + unknowns are skipped.)
        for (const f of sec.fields) {
          if (signal.aborted) throw new DOMException('aborted', 'AbortError');
          if (isFilled(this.nav.getValue(f.name), f.type)) { this.session.completed.add(f.name); this._recount(); continue; }
          if (f.type !== 'file' && this._hasProposed(f.name)) {
            await this._typeInto(f, this.session.values[f.name], signal);
          }
        }
        // PASS 2 — collaborate on the REMAINING required gaps only (data first, then documents),
        // one at a time: ask the citizen, then RESUME automatically the instant they provide it
        // (or the agent has since learned it via chat). Optional unknowns are left blank.
        for (const f of sec.fields) {
          if (signal.aborted) throw new DOMException('aborted', 'AbortError');
          if (!f.required || isFilled(this.nav.getValue(f.name), f.type)) continue;
          if (f.type === 'file') {
            store().update({ status: ExecStatus.WAITING, currentField: f.name, currentLabel: f.label, waitingFor: [{ name: f.name, label: f.label }], narration: `Please upload your ${f.label} — I'll continue as soon as it's attached.` });
            await this._wait([f], signal);
          } else {
            store().update({ status: ExecStatus.WAITING, currentField: f.name, currentLabel: f.label, waitingFor: [{ name: f.name, label: f.label }], narration: `I need your ${f.label} to continue — enter it and I'll carry on automatically.` });
            await this._wait([f], signal);
            // If the agent learned the value (via chat) rather than the citizen typing it, type it.
            if (!isFilled(this.nav.getValue(f.name), f.type) && this._hasProposed(f.name)) {
              store().update({ status: ExecStatus.TYPING, waitingFor: [], narration: 'Got it — continuing.' });
              await this._typeInto(f, this.session.values[f.name], signal);
              continue;
            }
          }
          store().update({ status: ExecStatus.SECTION, waitingFor: [], narration: 'Got it — continuing.' });
          this.session.completed.add(f.name);
          this._recount();
        }
        if (si < plan.length - 1) {
          store().update({ status: ExecStatus.SECTION, narration: `Moving to ${plan[si + 1].title}…` });
          await sleep(320, signal);
        }
      }
      // Surface anything still required that the agent couldn't fill — documents to upload AND
      // (when we stopped pausing after a user takeover of a wait) any data fields left blank.
      const pending = plan.flatMap((s) => s.fields)
        .filter((f) => f.required && !isFilled(this.nav.getValue(f.name), f.type));
      if (pending.length) {
        const docs = pending.filter((f) => f.type === 'file').map((f) => f.label);
        const data = pending.filter((f) => f.type !== 'file').map((f) => f.label);
        const parts = [];
        if (data.length) parts.push(`complete ${data.join(', ')}`);
        if (docs.length) parts.push(`upload ${docs.join(', ')}`);
        store().update({
          status: ExecStatus.COMPLETED, currentField: null, currentLabel: null,
          waitingFor: pending.map((f) => ({ name: f.name, label: f.label })),
          narration: `I've filled in everything I can. Please ${parts.join(' and ')}, then review and submit.`,
        });
      } else {
        this.nav.openReview?.(); // advance to the review step so the citizen can submit
        store().update({ status: ExecStatus.COMPLETED, currentField: null, currentLabel: null, waitingFor: [], narration: "All set — I've completed your application. Please review the details and submit." });
      }
      this.session = null; // finished cleanly; a later start() begins fresh
    } catch (err) {
      if (err?.name === 'AbortError') {
        store().update({ status: ExecStatus.STOPPED, currentField: null, currentLabel: null, narration: 'Paused — you can keep editing, and ask me to continue anytime.' });
        // session is preserved → the next start() resumes from the pointer
      } else {
        store().update({ status: ExecStatus.STOPPED });
        // eslint-disable-next-line no-console
        console.error('[AskGov] execution error', err);
      }
    } finally {
      this.running = false;
      this._teardownInterrupt();
      // Auto-dismiss the panel only on a clean finish; keep it if documents are still needed.
      if (store().status === ExecStatus.COMPLETED && store().waitingFor.length === 0) {
        setTimeout(() => store().update({ active: false }), 4000);
      }
    }
  }

  async _typeInto(field, value, signal) {
    store().update({ status: ExecStatus.TYPING, currentField: field.name, currentLabel: field.label, waitingFor: [], narration: `Entering ${field.label}…` });
    await typeField({
      name: field.name,
      value,
      root: this.nav.root(),
      commit: this.nav.commit,
      signal,
      hooks: { onThink: () => store().update({ status: ExecStatus.THINKING, narration: `Recalling your ${field.label}…` }) },
    });
    this.session.completed.add(field.name);
    this._recount();
    await sleep(getTypingConfig().fieldPause, signal);
  }
}
