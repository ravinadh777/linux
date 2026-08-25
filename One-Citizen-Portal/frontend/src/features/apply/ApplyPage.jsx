import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid, Card, CardContent, Typography, TextField, Button, Stack, Alert, MenuItem, Box,
  Select, Checkbox, ListItemText, OutlinedInput, InputLabel, FormControl, Chip, FormHelperText,
  Divider, Stepper, Step, StepLabel, StepContent, FormControlLabel, Radio, RadioGroup,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { api, apiError } from '../../lib/api.js';
import { toast } from '../../stores/toastStore.js';
import { Loading, ErrorState, PageHeader, StepProgress, StepLink, DataRow } from '../../components/ui.jsx';
import DocumentUpload from '../../components/DocumentUpload.jsx';
import { useAssistantStore } from '../../stores/assistantStore.js';
import { useUiStore } from '../../stores/uiStore.js';
import { getServiceForm } from './forms/index.js';
import { resolveProfileValues } from './prefillFromProfile.js';
import { useApplicationDraft } from './useApplicationDraft.js';
import DraftStatus from './DraftStatus.jsx';
import {
  topLevelFields, isRepeatSection, blankRow, visibleFields,
  sectionComplete, sectionMissing, useFormOptions, optionsForField, RepeatGroup,
} from './formCapabilities.jsx';
import {
  isTintService, submitToMoha, checkTintEligibility, useTintConnector,
  mohaUploadFor, mohaDraftTransport, mohaPrefill, getRemoteId, TINT_APPLICATIONS_KEY,
} from '../tint/tintSync.jsx';
import { useAgentFormSync } from '../../agent/index.js';
import { AgentExecutionEngine } from '../../agent/execution/agentExecutionEngine.js';
import { buildPlan } from '../../agent/execution/plan.js';
import { useExecutionStore, useExecActiveField, ExecStatus } from '../../agent/execution/executionStore.js';

// Statuses where the agent engine is actively driving navigation — manual auto-advance stands
// down during these; at every other time (idle/completed/stopped) manual progression is free.
const AGENT_BUSY = new Set([
  ExecStatus.REVIEWING, ExecStatus.SECTION, ExecStatus.TYPING, ExecStatus.THINKING, ExecStatus.WAITING,
]);

// `topLevelFields` excludes repeat sections — their fields live inside an array, not
// as flat RHF keys. See formCapabilities.jsx.
const flatten = (form) => topLevelFields(form);
const defaultsFor = (fields) =>
  Object.fromEntries(fields.map((f) => [f.name, f.type === 'multiselect' ? [] : f.type === 'checkbox' ? false : '']));

/** Defaults for the whole form, including one blank row per repeat section. */
const formDefaults = (form) => {
  const out = defaultsFor(topLevelFields(form));
  for (const s of form?.sections || []) {
    if (isRepeatSection(s)) out[s.repeat.name] = [blankRow(s)];
  }
  return out;
};

// A File object cannot be serialised to JSON, and the vault already holds the real
// upload — the draft tracks documents separately, as metadata, in `docMeta`. Dropping
// them here keeps the autosave payload clean and small.
const stripFiles = (values) => {
  const out = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (v instanceof File || v instanceof FileList || v instanceof Blob) continue;
    out[k] = v;
  }
  return out;
};

// Field label with a red asterisk for mandatory fields (accessible: aria-hidden on the mark).
function Req({ label, required }) {
  return (
    <>
      {label}
      {required ? <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }} aria-hidden> *</Box> : null}
    </>
  );
}

// True when every REQUIRED field of a section is satisfied (shared by gating + agent
// auto-advance). Delegates to the shared implementation in formCapabilities.jsx so the
// advance-gate, the agent engine, the review step and submit cannot disagree about
// whether a section is finished — and so conditional (`showWhen`) and repeatable
// (`repeat`) sections are handled identically everywhere.
const isSectionComplete = (section, vals) => sectionComplete(section, vals);

export default function ApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setFormApi = useAssistantStore((s) => s.setFormApi);
  const clearFormApi = useAssistantStore((s) => s.clearFormApi);
  const setFormProgress = useAssistantStore((s) => s.setFormProgress);
  const setAssistantOpen = useUiStore((s) => s.setAssistantOpen);
  const [submitError, setSubmitError] = useState('');
  const [filled, setFilled] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [docMeta, setDocMeta] = useState({}); // fieldName -> { documentId, filename, type, label }
  // True once a stored draft has been put back into the form, so the citizen is told
  // their earlier work was recovered rather than silently finding it there.
  const [resumedAt, setResumedAt] = useState(null);

  // ── Draft autosave / resume ─────────────────────────────────────────────────
  // Server-side, keyed to (citizen, service). This is what makes a refresh, an
  // auto-logout, a closed tab or a change of device non-destructive.
  // For the two Tint services the draft lives in the MOHA Applicant API, not in the
  // portal's `application_drafts` table — MOHA is the system of record for a waiver.
  // Every other service keeps the portal transport, unchanged.
  const draft = useApplicationDraft(id, {
    transport: isTintService(id) ? mohaDraftTransport : undefined,
  });

  const { data: svc, isLoading, error } = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.get(`/catalogue/services/${id}`).then((r) => r.data),
  });

  // The citizen's stored PORTAL profile — the data source the Typing Engine fills from.
  //
  // Skipped entirely for the Tint services: their applicant profile comes from MOHA
  // (GET /v1/me, see the prefill effect below), so fetching the portal profile too
  // would be a request whose result is never read.
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/me').then((r) => r.data),
    enabled: !isTintService(id),
  });

  // Form field definitions are owned by the frontend (see ./forms), not fetched from the API.
  const form = useMemo(() => getServiceForm(id), [id]);
  const sections = useMemo(() => form.sections || [], [form]);
  const fields = flatten(form);
  const fileFields = fields.filter((f) => f.type === 'file');
  const isAppointment = id === 'book-appointment';
  const { control, handleSubmit, reset, setValue, getValues, watch, trigger, formState: { errors } } = useForm({ defaultValues: {}, mode: 'onTouched' });
  const formRef = useRef(null);       // scopes the Typing Engine's field lookups to this form
  const engineRef = useRef(null);     // the resumable AgentExecutionEngine for this form
  // Set when the citizen navigates by intent (Back / a step chip / Review "Edit") so the
  // auto-advance effect does NOT immediately bounce them forward off an already-complete section.
  const manualNavRef = useRef(false);
  // One-shot guard so AskGov auto-fills the form from the citizen's records exactly once per service.
  const autoFillRef = useRef(null);

  // Bidirectional AG-UI sync: push live form edits into the agent's context (Phase 6).
  useAgentFormSync(watch);
  // The field the agent is actively filling — drives an accessible ARIA cue only.
  const typingField = useExecActiveField();

  // Reference-backed option lists for any field using `optionsKey` (see
  // formCapabilities.jsx). One fetch, cached an hour; forms with only literal
  // `options` arrays never touch it.
  const formOptions = useFormOptions();

  // ── MOHA Tint Waiver ────────────────────────────────────────────────────────
  // These two services hand off to the MOHA Applicant API after the portal submit.
  const isTint = isTintService(id);
  const tintConn = useTintConnector(isTint);
  // registrationNumber -> { canApply, checked, reason }. Advisory only.
  const [tintEligibility, setTintEligibility] = useState({});

  // `watch()` rather than `getValues()`, and the difference matters: conditional
  // fields (`showWhen`) and dependent option lists (`dependsOn`) have to re-evaluate
  // when the field they depend on changes. `getValues()` reads without subscribing, so
  // choosing "Self-Employed" would leave the employer block on screen until some other
  // state happened to force a render. Declared here (not further down) so the section
  // renderer can use it. Inputs are reconciled in place, so the extra renders do not
  // cost focus mid-typing.
  const values = watch();

  // Field names per section — used to validate one step at a time before advancing.
  /**
   * The RHF field paths to VALIDATE for a step, given the current values.
   *
   * This is deliberately not `stepFieldNames`, and the difference is load-bearing.
   * `trigger()` runs a field's rules whether or not it is on screen, and RHF keeps
   * errors for unmounted fields. So a section containing conditional fields could
   * never be left: choosing "Self-Employed" hides the four employer fields, the
   * completeness gate correctly says the section is done, but `trigger()` still fails
   * their `required` rules and the stepper silently refuses to advance — a dead end
   * with no visible cause.
   *
   * Repeat sections resolve to their real array paths (`vehicles.0.chassisNumber`),
   * because their bare names do not exist at the top level and validating them would
   * always pass vacuously.
   */
  const activeFieldNames = (i) => {
    const s = sections[i];
    if (!s) return [];
    if (isRepeatSection(s)) {
      const rows = values?.[s.repeat.name] || [];
      return rows.flatMap((_row, idx) => (s.fields || []).map((f) => `${s.repeat.name}.${idx}.${f.name}`));
    }
    return visibleFields(s, values).map((f) => f.name);
  };

  /**
   * Has validation actually RUN and failed for this step? Used so the "still needed"
   * banner appears only after the citizen has tried to advance, not the moment they
   * open a blank section. Repeat rows nest their errors (`errors.vehicles[0].make`),
   * so a dotted path cannot be looked up with `errors[name]`.
   */
  const hasStepError = (i) => activeFieldNames(i).some((path) =>
    path.split('.').reduce((node, key) => (node == null ? node : node[key]), errors) != null);
  const reviewStep = sections.length;          // review is the step after the last section
  const totalSteps = sections.length + 1;

  useEffect(() => {
    reset(formDefaults(form)); setActiveStep(0); setDeclared(false);
    autoFillRef.current = null; // re-arm the one-shot auto-fill for the new service
    useExecutionStore.getState().handToAgent(); // fresh form → agent owns it until the user acts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Population is agent-driven (AG-UI): AskGov types the values in via the Typing Engine,
  // pulling the citizen's real held records. It is auto-triggered once per form below.

  // Register this form so AskGov can read/fill/clear it — all filling runs through the
  // resumable AgentExecutionEngine, which treats the form as a workflow: it opens a section,
  // types each known field (real keystrokes via the Typing Engine), skips already-filled
  // fields (never overwrites), and PAUSES on a missing mandatory field, resuming automatically
  // when the citizen provides it — never restarting.
  useEffect(() => {
    if (!svc) return;
    const publicFields = fields.map((f) => ({ name: f.name, label: f.label, type: f.type, options: f.options, required: f.required }));

    // FormNavigator: the only seam between the generic engine and this concrete RHF form.
    const navigator = {
      serviceName: svc.name,
      plan: buildPlan(sections),
      root: () => formRef.current,
      getValue: (name) => getValues(name),
      commit: (name, value) => setValue(name, value, { shouldDirty: true, shouldValidate: false }),
      // Advance to Review ONLY if every section's mandatory fields are filled; otherwise land the
      // citizen on the first section that still needs input (never jump past incomplete mandatory).
      openReview: () => {
        const idx = sections.findIndex((s) => !isSectionComplete(s, getValues()));
        setActiveStep(idx === -1 ? reviewStep : idx);
      },
      // Open a section and resolve once its inputs have actually rendered (incremental discovery).
      ready: (i) => new Promise((resolve) => {
        setActiveStep(i);
        const first = (sections[i]?.fields || []).find((f) => f.type !== 'file');
        let tries = 0;
        const check = () => {
          tries += 1;
          const ready = !first || formRef.current?.querySelector(`[name="${window.CSS?.escape ? CSS.escape(first.name) : first.name}"]`);
          if (ready || tries > 45) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    };

    const startAgentFill = (values) => {
      setFilled(true);
      if (!engineRef.current) engineRef.current = new AgentExecutionEngine();
      engineRef.current.start({ values: values || {}, navigator });
    };

    setFormApi({
      serviceId: id,
      serviceName: svc.name,
      fields: publicFields,
      getSnapshot: () => ({ ...getValues() }),
      // Start OR resume the agentic fill — merges newly-known values, never restarts.
      autoFillSequential: startAgentFill,
      // Direct set (used for Undo / programmatic clears) — no typing, no navigation.
      setValues: (values) => Object.entries(values || {}).forEach(([k, v]) => setValue(k, v, { shouldDirty: true, shouldValidate: false })),
      clear: () => { engineRef.current?.stop(); reset(formDefaults(form)); setDocMeta({}); setActiveStep(0); },
    });
    return () => { engineRef.current?.stop(); clearFormApi(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc]);

  // Auto-resume + live progress: every value change (citizen OR agent) notifies the engine,
  // so a paused workflow continues the instant the missing field becomes valid.
  useEffect(() => {
    const sub = watch(() => engineRef.current?.notifyChange());
    return () => sub?.unsubscribe?.();
  }, [watch]);

  // ── Restore a stored draft ───────────────────────────────────────────────────
  // Runs once per service, as soon as the draft arrives. Three things are put back:
  // the field values, the uploaded-document metadata, and the section the citizen was
  // on — so they land on the same step with the same content, not at step 1.
  //
  // `takeOver()` is essential here. The agent owns a fresh form and would otherwise
  // start typing profile values into it; a restored draft is the citizen's OWN work
  // and must win. Handing control to the user also stops the auto-fill effect below
  // from firing, so their corrections are never overwritten by stale profile data.
  useEffect(() => {
    const d = draft.restored;
    if (!d || !sections.length) return;
    useExecutionStore.getState().takeOver();

    // Only assign fields this form actually declares. A draft saved before a form
    // definition changed could otherwise inject values for fields that no longer
    // exist, which RHF would happily keep and submit.
    const known = new Set(fields.map((f) => f.name));
    for (const [name, value] of Object.entries(d.form || {})) {
      if (known.has(name)) setValue(name, value, { shouldDirty: false, shouldValidate: false });
    }
    if (d.documents && Object.keys(d.documents).length) {
      setDocMeta(d.documents);
      // Mirror each document back onto its RHF field, because the required-file
      // validators read the field value, not docMeta. Without this a restored draft
      // would show the file as uploaded but still block submit as "not uploaded".
      for (const [name, meta] of Object.entries(d.documents)) {
        if (known.has(name) && meta?.documentId) {
          setValue(name, meta.documentId, { shouldDirty: false, shouldValidate: false });
        }
      }
    }
    // Clamp to a step this form still has, in case the definition shrank.
    setActiveStep(Math.min(Number(d.activeStep) || 0, sections.length));
    manualNavRef.current = true; // treat as intentional, so auto-advance leaves it alone
    autoFillRef.current = id;    // and the one-shot profile auto-fill stays disarmed
    setResumedAt(d.lastSavedAt || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.restored, sections.length]);

  // ── MOHA profile prefill (Tint only) ────────────────────────────────────────
  // GET /v1/me is the ONLY source for these two services. Runs once, never over a
  // restored draft (the citizen's own saved answers always beat a profile
  // suggestion), and never over a field they have already typed into.
  const mohaPrefilledRef = useRef(false);
  useEffect(() => {
    if (!isTint || mohaPrefilledRef.current) return;
    if (draft.status === 'loading') return;   // a draft outranks the profile
    if (draft.restored) { mohaPrefilledRef.current = true; return; }
    mohaPrefilledRef.current = true;
    mohaPrefill().then((res) => {
      if (!res.ok || !Object.keys(res.values).length) return;
      for (const [k, v] of Object.entries(res.values)) {
        if (!getValues(k)) setValue(k, v, { shouldDirty: false, shouldValidate: false });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTint, draft.status, draft.restored]);

  // ── Autosave ─────────────────────────────────────────────────────────────────
  // Watches every value change (citizen typing OR the agent filling) plus document
  // uploads and step moves, and queues a debounced PUT. The hook itself refuses to
  // save before the initial load has finished or when the payload is empty, so this
  // can never overwrite a good stored draft with a blank form — see
  // useApplicationDraft.js for those guards.
  useEffect(() => {
    if (!svc) return undefined;
    const sub = watch((values) => {
      draft.queueSave({ form: stripFiles(values), documents: docMeta, activeStep });
    });
    return () => sub?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, svc, docMeta, activeStep]);

  // Uploads and step changes are not RHF value events, so they get their own trigger.
  useEffect(() => {
    if (!svc) return;
    draft.queueSave({ form: stripFiles(getValues()), documents: docMeta, activeStep });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docMeta, activeStep, svc]);

  // Write any pending edit out when the citizen navigates away. Without this, up to
  // one debounce window of typing (1.2s) would be lost on a route change — the exact
  // moment someone clicks "Cancel and go back" having just typed something.
  useEffect(() => () => { draft.flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Robust progression: whenever the current section becomes complete — by typing, manual
  // entry, or a document upload — advance toward Review (unless the engine is actively driving).
  // This guarantees the citizen always reaches Review & submit, from either flow. (Inlined so it
  // never depends on helpers declared after the loading guard.)
  useEffect(() => {
    if (!svc || activeStep >= reviewStep) return;
    // The citizen just navigated here on purpose (Back / step chip / Edit) — honour it and
    // don't auto-advance off this section even though it is already complete.
    if (manualNavRef.current) { manualNavRef.current = false; return; }
    if (AGENT_BUSY.has(useExecutionStore.getState().status)) return;
    if (!canAdvance(activeStep)) return; // single gate — data fields AND required documents
    trigger(activeFieldNames(activeStep)).then((ok) => {
      if (ok) setActiveStep((s) => (s === activeStep ? Math.min(s + 1, reviewStep) : s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docMeta, activeStep, svc]);

  // Publish live form progress so AskGov can guide the citizen section-by-section
  // (which step they're on, what's still needed, which documents are outstanding).
  useEffect(() => {
    if (!svc) return;
    const isReview = activeStep >= reviewStep;
    const documentsPending = fileFields.filter((f) => f.required && !docMeta[f.name]).map((f) => f.label);
    setFormProgress({
      serviceName: svc.name,
      activeIndex: activeStep,
      total: sections.length,
      currentTitle: isReview ? 'Review & submit' : (sections[activeStep]?.title || null),
      isReview,
      documentsPending,
      complete: sections.every((s) => isSectionComplete(s, getValues())),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, docMeta, svc, filled]);

  // Fill the form from the citizen's REAL profile using the AG-UI Typing Engine. Values are
  // resolved to THIS form's own field names (resolveProfileValues), so every value lands in the
  // right input — no vocabulary/name mismatch. The citizen always reviews + submits themselves.
  // The actual fill: resolve the citizen's REAL profile to THIS form's field names and type them
  // in via the Typing Engine. Runs only while the agent owns the form.
  const runProfileFill = () => {
    if (useExecutionStore.getState().owner !== 'agent') return false;
    const formApi = useAssistantStore.getState().formApi;
    // Tint prefills from MOHA's own profile (GET /v1/me) — see the effect below —
    // because MOHA is the system of record for a waiver applicant. The portal profile
    // is not consulted for these two services.
    if (isTint) return false;
    if (!formApi || !me) return false;
    const values = resolveProfileValues(me, fields);
    if (!Object.keys(values).length) return false;
    setFilled(true);
    formApi.autoFillSequential(values); // types them in, human-paced (same engine as before)
    return true;
  };

  // Explicit user request ("Auto-fill" button / chat) — the ONLY way to re-hand control to the
  // agent after the user has taken over.
  const requestAgentFill = () => { useExecutionStore.getState().handToAgent(); runProfileFill(); };

  // STREAMLINED: as soon as the form + its AG-UI form API + the profile are ready, auto-fill
  // once — but ONLY if the agent still owns the form (the user hasn't already touched it).
  //
  // Now ALSO waits for the draft check to finish. Without that wait there is a race the
  // citizen would lose: the profile auto-fill starts typing into an empty form while the
  // stored draft is still in flight, and whichever lands second wins. Since the draft is
  // the citizen's own work and the profile is only a suggestion, the draft must always
  // win — so nothing is typed until we know whether one exists.
  useEffect(() => {
    if (!svc || !me || autoFillRef.current === id) return;
    if (draft.status === 'loading') return;  // draft check still pending — wait
    if (draft.restored) return;              // a draft exists; the restore effect owns the form
    if (!useAssistantStore.getState().formApi) return; // wait until the form registers its API
    autoFillRef.current = id;
    if (useExecutionStore.getState().owner === 'agent') runProfileFill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc, me, id, draft.status, draft.restored]);

  /** The portal submit path, unchanged, used by every non-Tint service. */
  const portalSubmit = (values) => {
    draft.disable();
    const form = { ...values };
    const documents = [];
    for (const f of fileFields) {
      const meta = docMeta[f.name];
      if (meta) documents.push({ field: f.name, label: f.label, type: f.docType, documentId: meta.documentId, filename: meta.filename });
      delete form[f.name];
    }
    return api.post('/applications', { serviceId: id, form, documents }).then((r) => r.data);
  };

  const submit = useMutation({
    mutationFn: async (values) => {
      // ── Tint Waiver: submitted DIRECTLY to MOHA ─────────────────────────────
      // No portal application row is created. MOHA allocates the real
      // TINT-YYYY-NNNNNN reference, runs its own vehicle duplicate check and emails
      // the applicant, so a second portal record would be a duplicate with a
      // competing reference number.
      //
      // Unlike the portal path this can genuinely fail with nothing saved, so the
      // error is thrown rather than swallowed — onError surfaces it and the citizen
      // stays on the form with their answers intact.
      if (isTint) {
        draft.disable();
        const outcome = await submitToMoha({
          serviceId: id,
          formValues: values,
          documents: tintDocuments(),
          remoteId: getRemoteId(id),
        });
        if (!outcome.synced) {
          const e = new Error(outcome.reason || 'The Tint Waiver service rejected this application.');
          e.tintOutcome = outcome;
          throw e;
        }
        return {
          id: outcome.remoteId,
          reference: outcome.remoteReference || outcome.remoteId,
          __moha: outcome,
        };
      }
      return portalSubmit(values);
    },
    onSuccess: (app) => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      // The KPI strip and the drafts list both move on submit, so refresh them too.
      qc.invalidateQueries({ queryKey: ['kpis'] });
      qc.invalidateQueries({ queryKey: ['drafts'] });

      if (isTint) {
        // The MOHA submit already succeeded — `app.reference` IS the real
        // TINT-YYYY-NNNNNN MOHA allocated. Tint applications live in MOHA, not the
        // portal, so tracking goes to the MOHA-backed list rather than /tracking/:id.
        // Invalidate the SAME key the MOHA list/detail/KPI reads use, so the freshly
        // submitted waiver is on the tracking page by the time we land on it. A key that
        // does not match any query invalidates nothing and fails silently.
        qc.invalidateQueries({ queryKey: TINT_APPLICATIONS_KEY });
        toast.success(`Application submitted to MOHA — reference ${app.reference}.`);
        navigate('/tracking');
        return;
      }

      toast.success(isAppointment
        ? `Appointment requested — reference ${app.reference}.`
        : `Application submitted — reference ${app.reference}.`);
      navigate(`/tracking/${app.id}`);
    },
    onError: (err) => {
      setSubmitError(apiError(err));
      // Submit failed, so the citizen still needs their draft. Re-arm autosave and
      // write the current state out immediately — otherwise a failed submit would be
      // the one moment autosave is off and their work is unprotected.
      draft.saveNow({ form: stripFiles(getValues()), documents: docMeta, activeStep });
    },
  });

  /** Document metadata in the shape the MOHA formData expects. */
  const tintDocuments = () => fileFields
    .filter((f) => docMeta[f.name])
    .map((f) => ({ field: f.name, label: f.label, type: f.docType, ...docMeta[f.name] }));

  // ── Explicit "Save and finish later" ─────────────────────────────────────────
  // Autosave already runs continuously, so this is not strictly required to protect
  // the data — but a citizen who is about to walk away needs to be ABLE TO ACT on
  // that intent and get confirmation. An invisible guarantee is not a guarantee they
  // can trust. It also flushes synchronously, so leaving immediately after is safe.
  const [saving, setSaving] = useState(false);
  const saveDraft = async () => {
    setSaving(true);
    setSubmitError('');
    const ok = await draft.saveNow({ form: stripFiles(getValues()), documents: docMeta, activeStep });
    setSaving(false);
    if (!ok) {
      // For Tint there is no portal fallback — MOHA IS the store — so a failed save
      // means nothing was persisted. Say so plainly rather than the generic message,
      // because the citizen needs to know not to keep typing.
      toast.error(isTint
        ? 'Your draft could NOT be saved to the Ministry of Home Affairs. Nothing has been stored — do not close this page.'
        : 'We could not save your progress just now. Check your connection and try again.');
      return;
    }
    toast.success(isTint
      ? 'Draft saved with the Ministry of Home Affairs. You can close this page and finish it later.'
      : 'Saved. You can close this page and finish it later from your dashboard.');
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  // `!svc` is a THIRD state, not a redundant one. A react-query query can settle with
  // neither `isLoading` nor `error` true and still have no data — most reachably when
  // the portal session expires mid-page: the catalogue request 401s, the interceptor
  // attempts a refresh, and a render happens in that window. Without this guard the
  // very next line reads `svc.name` and the whole form is replaced by the error
  // boundary, which is a far worse outcome than a spinner while the session recovers.
  if (!svc) return <Loading />;

  // ── Auto-advance ─────────────────────────────────────────────────────────────
  // A section opens the next one automatically once every REQUIRED field/document is
  // satisfied — optional fields and documents never block. Completeness is checked
  // silently (no error flash); only when the mandatory items are done do we run
  // validation and move on. This covers: filling the last field, blurring out of it, and
  // sections where the citizen only uploads the mandatory documents and skips optional ones.
  // ── SINGLE SOURCE OF TRUTH for leaving a section ─────────────────────────────
  // Every mandatory item in section i must be satisfied: data fields non-empty/valid, AND every
  // required DOCUMENT uploaded (authoritative: docMeta, with the RHF value as a fallback so the
  // two can never desync into a false pass/fail). This ONE function gates every advance path.
  // `docMeta` is passed so an uploaded document counts even before RHF's value has
  // settled — the two can otherwise disagree and produce a false block.
  const canAdvance = (i) => sectionComplete(sections[i], getValues(), docMeta);

  // Advance to the next section ONLY when the current section's requirements are met. If not, we
  // validate to flag the exact missing fields/documents and STAY put — no advance under any trigger.
  const maybeAdvance = async (i) => {
    if (AGENT_BUSY.has(useExecutionStore.getState().status)) return; // engine owns nav while running
    setSubmitError('');
    if (!canAdvance(i)) { trigger(activeFieldNames(i)); return; } // stay + surface what's missing
    const ok = await trigger(activeFieldNames(i)); // final validity (formats/masks) check
    if (ok) setActiveStep((s) => (s === i ? Math.min(s + 1, reviewStep) : s));
  };
  const goBack = () => { manualNavRef.current = true; setActiveStep((s) => Math.max(s - 1, 0)); };
  // First section (0-based) whose mandatory fields aren't all filled — the furthest point the
  // citizen may move FORWARD to. -1 → every section is complete (Review is reachable).
  const firstIncompleteSection = () => {
    const idx = sections.findIndex((s, i) => !canAdvance(i));
    return idx === -1 ? reviewStep : idx;
  };
  // Jump to a step by intent (side-rail chip / Review "Edit"). Going BACK is always allowed;
  // going FORWARD is capped at the first section with unfilled mandatory fields, so you can
  // never skip ahead past incomplete required input (the blocking section's errors are shown).
  const goToStep = (i) => {
    manualNavRef.current = true;
    if (i <= activeStep) { setActiveStep(i); return; }
    const cap = firstIncompleteSection();
    const target = Math.min(i, cap);
    if (target < i) trigger(activeFieldNames(cap)); // flag what's blocking the jump
    setActiveStep(target);
  };

  const renderField = (f, { stepIndex = 0 } = {}) => {
    const rules = f.required ? { required: `${f.label} is required` } : {};
    const err = errors[f.name];
    const advance = () => setTimeout(() => maybeAdvance(stepIndex), 0);
    // On blur, advance only if focus actually left this section (not moving to another
    // field within it, and not to the Back control).
    const blurAdvance = (e) => {
      const rt = e?.relatedTarget;
      if (rt?.dataset?.noAdvance) return;
      const box = e.currentTarget?.closest?.('[data-section]');
      if (box && rt && box.contains(rt)) return;
      advance();
    };
    // MOHA duplicate check, on blur of the plate. Advisory only — a failure never
    // blocks, because the same check runs server-side on submit and the citizen
    // cannot influence a connector problem.
    const maybeCheckEligibility = (e) => {
      if (!isTint || f.name !== 'registrationNumber') return;
      const reg = String(e?.target?.value || '').trim().toUpperCase();
      if (!reg || tintEligibility[reg]) return;
      checkTintEligibility(reg).then((r) => { if (r) setTintEligibility((m) => ({ ...m, [reg]: r })); });
    };
    if (f.type === 'file') {
      return (
        <Controller key={f.name} name={f.name} control={control} rules={f.required ? { validate: (v) => !!v || `${f.label} is required` } : {}}
          render={({ field }) => (
            <DocumentUpload
              label={f.label} docType={f.docType} required={f.required} value={field.value} filename={docMeta[f.name]?.filename} error={err?.message}
              scanStatus={docMeta[f.name]?.scanStatus}
              // Tint documents go to MOHA's signed-URL store INSTEAD of the portal
              // vault — MOHA is the system of record for a waiver. Every other
              // service still uses the vault.
              uploader={isTint ? mohaUploadFor(f) : undefined}
              onUploaded={(meta) => {
                field.onChange(meta.documentId);
                setDocMeta((m) => ({ ...m, [f.name]: { ...meta, type: f.docType, label: f.label } }));
                advance();
              }}
              onRemove={() => {
                field.onChange('');
                setDocMeta((m) => { const c = { ...m }; delete c[f.name]; return c; });
              }}
            />
          )} />
      );
    }
    if (f.type === 'checkbox') {
      return (
        <Controller key={f.name} name={f.name} control={control} rules={f.required ? { validate: (v) => v === true || `${f.label} is required` } : {}}
          render={({ field }) => (
            <FormControl error={!!err}>
              <FormControlLabel control={<Checkbox {...field} checked={!!field.value} onChange={(e) => { field.onChange(e); advance(); }} />} label={<Req label={f.label} required={f.required} />} />
              {(err?.message || f.help) && <FormHelperText>{err?.message || f.help}</FormHelperText>}
            </FormControl>
          )} />
      );
    }
    if (f.type === 'radio') {
      return (
        <Controller key={f.name} name={f.name} control={control} rules={rules}
          render={({ field }) => (
            <FormControl error={!!err}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}><Req label={f.label} required={f.required} /></Typography>
              <RadioGroup row {...field} onChange={(e) => { field.onChange(e); advance(); }}>
                {(f.options || []).map((o) => <FormControlLabel key={o} value={o} control={<Radio size="small" />} label={o} />)}
              </RadioGroup>
              {(err?.message || f.help) && <FormHelperText>{err?.message || f.help}</FormHelperText>}
            </FormControl>
          )} />
      );
    }
    if (f.type === 'select') {
      // Options come either from a literal `options` array (every pre-existing form)
      // or from reference data via `optionsKey`. `configured: false` means the list is
      // legitimately not supplied yet — the field is disabled and says so, rather than
      // showing an empty dropdown that reads as a broken page.
      const { options: opts, configured, dependencyUnmet } = optionsForField(f, values, formOptions);
      // `freeText` is the escape hatch for a REQUIRED select whose list MOHA has not
      // supplied (Medical Condition). Blocking there would make the commonest
      // exemption category impossible to apply for, and the API takes the value as a
      // plain string anyway — so it degrades to a validated text input rather than a
      // dead end. Without `freeText`, an unconfigured list still blocks, because
      // inventing an option would be worse than stopping.
      if (!configured && f.freeText) {
        return (
          <Controller key={f.name} name={f.name} control={control} rules={rules}
            render={({ field }) => (
              <TextField {...field} value={field.value ?? ''}
                onBlur={(e) => { field.onBlur(e); blurAdvance(e); }}
                fullWidth label={<Req label={f.label} required={f.required} />}
                error={!!err}
                helperText={err?.message || 'Type the value — no list is configured yet.'} />
            )} />
        );
      }
      const blocked = !configured || dependencyUnmet;
      const blockedText = dependencyUnmet
        ? `Choose ${f.dependsOn === 'vehicleMake' ? 'a Vehicle Make' : 'the previous field'} first`
        : 'Awaiting reference data for this list — it cannot be completed yet.';
      return (
        <Controller key={f.name} name={f.name} control={control} rules={rules}
          render={({ field }) => (
            <TextField {...field} value={field.value ?? ''} onChange={(e) => { field.onChange(e); advance(); }}
              select fullWidth disabled={blocked}
              label={<Req label={f.label} required={f.required} />} error={!!err}
              helperText={err?.message || (blocked ? blockedText : f.help)}>
              {opts.map((o) => {
                const val = typeof o === 'string' ? o : (o.value ?? o.code ?? o.name);
                const lbl = typeof o === 'string' ? o : (o.label ?? o.name ?? val);
                return <MenuItem key={val} value={val}>{lbl}</MenuItem>;
              })}
            </TextField>
          )} />
      );
    }
    if (f.type === 'multiselect') {
      return (
        <Controller key={f.name} name={f.name} control={control} rules={f.required ? { validate: (v) => (v && v.length) || `${f.label} is required` } : {}}
          render={({ field }) => (
            <FormControl fullWidth error={!!err}>
              <InputLabel><Req label={f.label} required={f.required} /></InputLabel>
              <Select multiple {...field} value={Array.isArray(field.value) ? field.value : []} input={<OutlinedInput label={f.label} />}
                onClose={advance}
                renderValue={(sel) => (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>{(sel || []).map((v) => <Chip key={v} size="small" label={v} />)}</Box>
                )}>
                {(f.options || []).map((o) => (
                  <MenuItem key={o} value={o}>
                    <Checkbox checked={(field.value || []).indexOf(o) > -1} />
                    <ListItemText primary={o} />
                  </MenuItem>
                ))}
              </Select>
              {(err?.message || f.help) && <FormHelperText>{err?.message || f.help}</FormHelperText>}
            </FormControl>
          )} />
      );
    }
    const type = f.type === 'textarea' ? 'text' : f.type;
    return (
      <Controller key={f.name} name={f.name} control={control} rules={rules}
        render={({ field }) => {
          const len = String(field.value ?? '').length;
          return (
            <Box>
              <TextField {...field} value={field.value ?? ''} onBlur={(e) => { field.onBlur(e); maybeCheckEligibility(e); blurAdvance(e); }}
                onChange={(e) => {
                  let v = e.target.value;
                  // `max` HARD-CAPS rather than warning. The API has real column
                  // limits (chassis 17, registration 10, licence 12), so truncating
                  // here is what stops a submit failing on length after the citizen
                  // has filled in everything else.
                  if (f.max && v.length > f.max) v = v.slice(0, f.max);
                  // Plates and chassis/VIN are upper-case in MOHA's records; a
                  // lower-case plate would fail their duplicate check.
                  if (f.uppercase) v = v.toUpperCase();
                  field.onChange(v);
                }}
                fullWidth label={<Req label={f.label} required={f.required} />} type={type || 'text'}
                multiline={f.type === 'textarea'} minRows={f.type === 'textarea' ? 3 : undefined}
                placeholder={f.placeholder} error={!!err} helperText={err?.message || f.help}
                inputProps={{ maxLength: f.max }}
                InputLabelProps={f.type === 'date' ? { shrink: true } : undefined} />
              {/* Character counter, as the MOHA screens show (0/100, 0/200, 0/15…). */}
              {f.max ? (
                <Typography variant="caption"
                  sx={{ display: 'block', textAlign: 'right', mt: 0.25, color: len >= f.max ? 'warning.text' : 'text.secondary' }}>
                  {len}/{f.max}
                </Typography>
              ) : null}
            </Box>
          );
        }} />
    );
  };

  const fieldSpan = (f) => (['textarea', 'multiselect', 'file', 'radio', 'checkbox'].includes(f.type) ? 12 : 6);

  // NOTE: a plain function that RETURNS elements (not a nested <Component/>). Rendering it via
  // {sectionFields(section, i)} keeps the inputs reconciled in place across re-renders, so an
  // input NEVER loses focus mid-typing (a nested component would remount and drop focus).
  const sectionFields = (section, stepIndex) => {
    // ── Repeatable section (e.g. an organisation's fleet of vehicles) ──────────
    // Rows are stored as an ARRAY under `section.repeat.name`, matching the shape the
    // receiving API expects, rather than as flat `vehicle1Make`-style keys. Each row
    // is registered with RHF under `vehicles.0.registrationNumber`, so validation,
    // dirty-tracking and the draft autosave all work unchanged.
    if (isRepeatSection(section)) {
      const rows = watch(section.repeat.name) || [];
      return (
        <Box data-section={stepIndex}>
          <RepeatGroup
            section={section}
            rows={rows}
            values={values}
            onChange={(next) => setValue(section.repeat.name, next, { shouldDirty: true })}
            rowMissing={rows.map((row) => (section.fields || [])
              .filter((f) => f.required && !String(row?.[f.name] ?? '').trim())
              .map((f) => f.label))}
            renderRowField={(f, i) => (
              <Controller
                key={`${section.repeat.name}.${i}.${f.name}`}
                name={`${section.repeat.name}.${i}.${f.name}`}
                control={control}
                rules={f.required ? { required: `${f.label} is required` } : {}}
                render={({ field, fieldState }) => {
                  const { options: opts, configured, dependencyUnmet } = optionsForField(f, rows[i] || {}, formOptions);
                  const blocked = f.type === 'select' && (!configured || dependencyUnmet);
                  if (f.type === 'select') {
                    return (
                      <TextField {...field} value={field.value ?? ''} select fullWidth disabled={blocked}
                        label={<Req label={f.label} required={f.required} />}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message
                          || (blocked ? (dependencyUnmet ? 'Choose a Vehicle Make first' : 'Awaiting reference data for this list.') : f.help)}>
                        {opts.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    );
                  }
                  const len = String(field.value ?? '').length;
                  return (
                    <Box>
                      <TextField {...field} value={field.value ?? ''} fullWidth
                        onChange={(e) => {
                          let v = e.target.value;
                          if (f.max && v.length > f.max) v = v.slice(0, f.max);
                          if (f.uppercase) v = v.toUpperCase();
                          field.onChange(v);
                        }}
                        label={<Req label={f.label} required={f.required} />}
                        type={f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text'}
                        error={!!fieldState.error} helperText={fieldState.error?.message || f.help}
                        inputProps={{ maxLength: f.max }}
                        InputLabelProps={f.type === 'date' ? { shrink: true } : undefined} />
                      {f.max ? (
                        <Typography variant="caption"
                          sx={{ display: 'block', textAlign: 'right', mt: 0.25, color: len >= f.max ? 'warning.text' : 'text.secondary' }}>
                          {len}/{f.max}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                }}
              />
            )}
          />
        </Box>
      );
    }

    return (
      <Box data-section={stepIndex}>
        <Grid container spacing={2}>
          {/* `visibleFields` applies each field's `showWhen`, so a conditional field
              (employer block when Self-Employed, medical condition when the category
              is not Medical) disappears AND stops being required — a hidden required
              field would make Next silently do nothing. */}
          {visibleFields(section, values).map((f) => {
            const isTyping = typingField === f.name;
            // No visual treatment on the field while the agent fills it — no border, no
            // ring, no glow, no badge. The only cue the engine leaves is the browser's
            // native focus ring as it moves from field to field, and `aria-busy` for
            // screen readers, which is not rendered.
            return (
              <Grid item xs={12} sm={fieldSpan(f)} key={f.name}>
                <Box aria-busy={isTyping || undefined}>
                  {renderField(f, { stepIndex })}
                  {/* MOHA duplicate-check verdict. Three distinct states, because
                      "could not check" is NOT the same as "eligible" — implying the
                      latter would let a citizen submit a vehicle MOHA will reject. */}
                  {isTint && f.name === 'registrationNumber' && (() => {
                    const reg = String(values[f.name] || '').trim().toUpperCase();
                    const e = tintEligibility[reg];
                    if (!reg || !e) return null;
                    if (e.canApply === false) return <Alert severity="error" sx={{ mt: 1 }}>{e.reason || 'This vehicle cannot be applied for.'}</Alert>;
                    if (e.canApply === true) return <Alert severity="success" sx={{ mt: 1 }}>This vehicle is eligible.</Alert>;
                    return <Alert severity="warning" sx={{ mt: 1 }}>Could not check this vehicle with MOHA now — it will be checked again on submission.</Alert>;
                  })()}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  // Back + Save. Advancing is still automatic once a section is complete, so there is
  // no Next; Save is offered on EVERY step rather than only at the end, because the
  // citizen who needs it most is the one who has to stop half way through.
  const BackBar = () => (
    <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      {activeStep > 0 && (
        <Button onClick={goBack} data-no-advance startIcon={<ArrowBackRoundedIcon />}>Back</Button>
      )}
      <Button
        onClick={saveDraft} data-no-advance disabled={saving}
        startIcon={<SaveRoundedIcon />} variant="outlined" color="inherit"
      >
        {saving ? 'Saving…' : 'Save and finish later'}
      </Button>
    </Box>
  );

  // Human-readable value for the review summary. (`values` is the live watched form —
  // declared near the top of the component.)
  const displayValue = (f) => {
    if (f.type === 'file') return docMeta[f.name]?.filename || (f.required ? 'Not uploaded' : '—');
    const v = values[f.name];
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    return v === '' || v === undefined || v === null ? '—' : String(v);
  };

  // Each section is a titled group with its own Edit affordance, so the citizen can
  // see at a glance which block a value belongs to. Previously every field in the
  // whole form ran together as undifferentiated caption/value pairs.
  const ReviewSummary = () => (
    <Stack spacing={2.5}>
      {sections.map((section, i) => (
        <Box key={section.title} sx={{ borderRadius: 2, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}
            sx={{ px: 2, py: 1.25, bgcolor: 'surface.sunken' }}>
            <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700 }}>{section.title}</Typography>
            <Button size="small" data-no-advance onClick={() => goToStep(i)}
              aria-label={`Edit ${section.title}`}>Edit</Button>
          </Stack>
          <Box component="dl" sx={{ m: 0, px: 2, py: 0.5 }}>
            {isRepeatSection(section) ? (
              // A repeat section holds an ARRAY, so it gets one labelled block per row.
              // Without this branch the section would render as an empty box — the
              // citizen would reach Review and find their vehicles apparently missing.
              <Stack spacing={1.5} sx={{ py: 1 }}>
                {(values[section.repeat.name] || []).map((row, idx) => (
                  <Box key={idx}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.onSubtle' }}>
                      {section.repeat.itemLabel || 'Item'} {idx + 1}
                    </Typography>
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {(section.fields || []).map((f) => (
                        <DataRow key={f.name} label={f.label}
                          value={row?.[f.name] === '' || row?.[f.name] == null ? '—' : String(row[f.name])} />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Stack divider={<Divider flexItem />} spacing={0}>
                {/* Only the fields actually in play — a hidden conditional field must
                    not appear in the summary as an empty row. */}
                {visibleFields(section, values).map((f) => (
                  <DataRow key={f.name} label={f.label} value={displayValue(f)} />
                ))}
              </Stack>
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  );

  // 1-based and inclusive, so the final "Review & submit" step reads 100%.
  // The previous `activeStep / totalSteps` meant a 3-section form showed 75% while
  // the citizen sat on the last step, and the bar could never fill.
  const stepNumber = Math.min(activeStep + 1, totalSteps);
  const completedDocs = fileFields.filter((f) => docMeta[f.name]).length;
  // Named, not just counted — "1 document still needed: Proof of address" tells the
  // citizen what to do; "2/3" makes them work it out.
  const outstandingDocs = fileFields.filter((f) => f.required && !docMeta[f.name]).map((f) => f.label);

  return (
    <>
      <PageHeader
        title={`Apply — ${svc.name}`}
        subtitle="Complete each section, review, then submit. Or let AskGov draft it from your profile."
        crumbs={[
          { label: 'Agencies', to: '/agencies' },
          { label: svc.agencyName, to: `/agencies/${svc.agencyCode}` },
          { label: svc.name, to: `/services/${id}` },
          { label: 'Apply' },
        ]}
      />

      {/* ── AskGov banner ──────────────────────────────────────────────────────
          Green gradient, in Tailwind rather than `sx`. It previously read
          `background: theme.gradients.brand`, and that key had been renamed away —
          so it resolved to `undefined` and rendered WHITE TEXT ON A WHITE CARD.
          Now it uses the palette directly: deep green → green, with a gold radial
          warming the right edge and a gold hairline on top so it reads as a
          deliberate feature strip rather than a coloured box. */}
      <div className="relative overflow-hidden rounded-card mb-[18px] text-white
                      bg-gradient-to-br from-primary-deep via-primary to-[#0F8A63]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gold/70" />
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(460px circle at 92% -40%, rgba(252,209,22,.20), transparent 60%),'
              + 'radial-gradient(360px circle at 4% 130%, rgba(255,255,255,.12), transparent 60%)',
          }}
        />

        <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span aria-hidden className="shrink-0 w-10 h-10 rounded-tile bg-white/15 grid place-items-center backdrop-blur-sm">
              <svg viewBox="0 0 18 18" width="19" height="19" fill="currentColor">
                <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="font-bold text-lg leading-snug">Let AskGov fill this in for you</p>
              <p className="text-sm text-white/85 mt-0.5 max-w-prose">
                It drafts each field from details you have already given government.
                You check every value and submit it yourself.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Gold is the primary action on green — ink on gold measures 10.09:1,
                the strongest pairing in the palette. */}
            <button
              type="button"
              onClick={requestAgentFill}
              className="oc-btn-gold oc-btn-sm"
            >
              <svg aria-hidden viewBox="0 0 18 18" width="15" height="15" fill="currentColor">
                <path d="M9 1.5l1.6 4.2 4.4 1.5-4.4 1.5L9 13l-1.6-4.3L3 7.2l4.4-1.5L9 1.5z" />
              </svg>
              Fill it in
            </button>
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="oc-btn oc-btn-sm bg-white/10 text-white border-white/40
                         hover:bg-white/20 hover:border-white"
            >
              Ask a question
            </button>
          </div>
        </div>
      </div>

      {/* ── Resumed-draft notice ───────────────────────────────────────────────
          Shown when stored progress was put back. This is the payoff for the whole
          draft mechanism, so it is stated explicitly: a citizen who was logged out
          mid-form needs to SEE that their work came back, not have to check it
          field by field and hope. */}
      {resumedAt && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setResumedAt(null)}>
          <strong>We picked up where you left off.</strong>{' '}
          Your answers were saved{' '}
          {new Date(resumedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {' '}and have been restored. Check them over, then carry on.
        </Alert>
      )}

      {/* A draft LOAD failure is worth saying out loud: the citizen may have progress
          stored that we could not reach, and starting to retype over it should be a
          decision they make knowingly rather than a surprise. */}
      {draft.loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          We could not check whether you had saved progress for this application.
          You can still fill it in — your answers will save as you go.
        </Alert>
      )}

      {/* ── MOHA connector notice ───────────────────────────────────────────────
          Stated BEFORE the citizen fills anything in, because it changes what they
          should expect at the end. `tokenVerified` is never asserted true from a health
          check (health needs no auth), so the honest position is: the portal will file
          your application either way, and the MOHA reference may follow later. */}
      {isTint && !tintConn.tokenConfigured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Not yet connected to the Ministry of Home Affairs.</strong> You can complete and
          submit this application — it is filed with the portal and nothing is lost — but it will not
          reach MOHA until the connection is configured, so no MOHA reference will be issued yet.
        </Alert>
      )}
      {isTint && tintConn.tokenConfigured && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This application is filed directly with the Ministry of Home Affairs ({tintConn.env}).
          Your progress is saved to MOHA as you go, so you can leave and pick it up later on any
          device.
        </Alert>
      )}
      {isTint && tintConn.isProduction && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Connected to the <strong>production</strong> MOHA service — anything submitted is a real waiver application.
        </Alert>
      )}

      {filled && (
        <Alert severity="success" sx={{ mb: 2 }}>
          AskGov has drafted this from your saved details. Check each section, correct anything
          that is out of date, then submit.
        </Alert>
      )}
      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError('')}>{submitError}</Alert>
      )}

      <form ref={formRef} onSubmit={handleSubmit((v) => { if (activeStep === reviewStep) submit.mutate(v); })}>
        <Grid container spacing={2} onKeyDown={(e) => { if (e.key === 'Enter' && activeStep !== reviewStep) e.preventDefault(); }}>
          {/* Stepper */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Stepper activeStep={activeStep} orientation="vertical">
                  {sections.map((section, i) => (
                    <Step key={section.title}>
                      <StepLabel optional={section.description ? <Typography variant="caption" color="text.secondary">{section.description}</Typography> : null}>
                        <Typography sx={{ fontWeight: 700 }}>{section.title}</Typography>
                      </StepLabel>
                      <StepContent>
                        <Box sx={{ pt: 1 }}>{sectionFields(section, i)}</Box>
                        {/* Names WHAT is outstanding rather than saying "the fields
                            highlighted above" — on a long section (Vehicle has 13
                            fields) that meant hunting for the red one. `sectionMissing`
                            is the same helper the advance-gate uses, so the message and
                            the gate can never disagree, and it enumerates repeat rows
                            individually ("Vehicle 2 — Colour"). */}
                        {!sectionComplete(section, values, docMeta) && hasStepError(i) && (() => {
                          const missing = sectionMissing(section, values, docMeta);
                          return (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                              {missing.length === 0
                                ? 'Complete the required fields highlighted above to continue.'
                                : missing.length === 1
                                  ? `${missing[0]} is still needed to continue.`
                                  : `Still needed to continue: ${missing.join(', ')}.`}
                            </Alert>
                          );
                        })()}
                        <BackBar />
                      </StepContent>
                    </Step>
                  ))}

                  {/* Review & submit */}
                  <Step key="__review">
                    <StepLabel
                      icon={<FactCheckRoundedIcon color={activeStep === reviewStep ? 'primary' : 'disabled'} />}
                      optional={<Typography variant="caption" color="text.secondary">Confirm your details before submitting</Typography>}
                    >
                      <Typography sx={{ fontWeight: 700 }}>Review &amp; submit</Typography>
                    </StepLabel>
                    <StepContent>
                      <Box sx={{ pt: 1 }}><ReviewSummary /></Box>

                      {/* The declaration is a legal act, so it gets its own bordered
                          block rather than sitting as one more checkbox in a stack. */}
                      <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, border: 1, borderColor: declared ? 'success.main' : 'divider', bgcolor: declared ? 'success.subtle' : 'surface.sunken' }}>
                        <FormControlLabel
                          sx={{ m: 0, alignItems: 'flex-start' }}
                          control={<Checkbox checked={declared} sx={{ mt: -0.75 }} onChange={(e) => setDeclared(e.target.checked)} />}
                          label={
                            <Typography variant="body2">
                              I declare that the information above is true and correct to the best of my knowledge.
                            </Typography>
                          }
                        />
                      </Box>

                      {/* SAVE and SUBMIT sit side by side at the decision point, with
                          Submit as the only high-emphasis control. Save is deliberately
                          present here too: reaching Review and then realising you need
                          one more document is the most common reason to stop, and the
                          citizen should not have to scroll back up a step to save. */}
                      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
                        <Button onClick={goBack} data-no-advance startIcon={<ArrowBackRoundedIcon />}>Back</Button>
                        <Button onClick={saveDraft} data-no-advance disabled={saving}
                          variant="outlined" color="inherit" startIcon={<SaveRoundedIcon />}>
                          {saving ? 'Saving…' : 'Save as draft'}
                        </Button>
                        <Button type="submit" variant="contained" size="large" startIcon={<CheckCircleRoundedIcon />}
                          disabled={!declared || submit.isPending}>
                          {submit.isPending ? (isAppointment ? 'Requesting…' : 'Submitting…') : (isAppointment ? 'Request appointment' : 'Submit application')}
                        </Button>
                      </Stack>
                      {/* Why submit is blocked, stated at the point of blockage rather
                          than only as a disabled button the citizen has to interpret. */}
                      {!declared && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Tick the declaration above to enable submission.
                        </Typography>
                      )}
                      {outstandingDocs.length > 0 && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                          {outstandingDocs.length === 1
                            ? `One document is still needed before you can submit: ${outstandingDocs[0]}.`
                            : `${outstandingDocs.length} documents are still needed before you can submit: ${outstandingDocs.join(', ')}.`}
                          {' '}Your answers are saved, so you can come back with them later.
                        </Alert>
                      )}
                      <DraftStatus status={draft.status} lastSavedAt={draft.lastSavedAt} className="mt-3" />
                    </StepContent>
                  </Step>
                </Stepper>
              </CardContent>
            </Card>
          </Grid>

          {/* Progress / summary side rail */}
          <Grid item xs={12} md={4}>
            <Card sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" component="h2">Your progress</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{svc.name} · {svc.agencyName}</Typography>

                <Box sx={{ mt: 2.5 }}>
                  <StepProgress current={stepNumber} total={totalSteps} outstanding={outstandingDocs} />
                </Box>

                {/* The autosave state lives here, next to the progress bar, because
                    this is where a citizen already looks to ask "how am I doing?" —
                    and "is my work safe?" is the same question. */}
                <DraftStatus status={draft.status} lastSavedAt={draft.lastSavedAt} className="mt-3" />

                <Stack spacing={0.25} sx={{ mt: 2.5 }}>
                  {sections.map((s, i) => (
                    <StepLink
                      key={s.title}
                      title={s.title}
                      state={i < activeStep ? 'done' : i === activeStep ? 'current' : 'todo'}
                      onClick={() => goToStep(i)}
                    />
                  ))}
                  <StepLink
                    title="Review &amp; submit"
                    state={activeStep >= reviewStep ? 'current' : 'todo'}
                    onClick={() => goToStep(reviewStep)}
                  />
                </Stack>

                {fileFields.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Documents uploaded: <Box component="strong" sx={{ color: 'text.primary' }}>{completedDocs} of {fileFields.length}</Box>
                    </Typography>
                  </>
                )}

                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  {isAppointment
                    ? 'The office confirms your slot after you submit. You can change it later from Tracking.'
                    : 'A government officer makes the final decision. You can check progress at any time under Tracking.'}
                </Typography>
                {/* Save is the primary rail action — it is the one thing a citizen who
                    has to stop needs to find without hunting. */}
                <Button fullWidth variant="contained" color="primary" data-no-advance sx={{ mt: 2 }}
                  onClick={saveDraft} disabled={saving} startIcon={<SaveRoundedIcon />}>
                  {saving ? 'Saving…' : 'Save and finish later'}
                </Button>

                {/* Cancel is a deliberate, low-emphasis outlined control rather than a
                    bare text link — findable when wanted, never competing with Submit.
                    The copy now says what actually happens: leaving does NOT discard
                    the work, because it is already saved. The previous "Cancel and go
                    back" implied the opposite and would make a careful citizen avoid
                    the button they wanted. */}
                <Button fullWidth variant="outlined" color="inherit" data-no-advance sx={{ mt: 1.5 }}
                  onClick={async () => { await draft.flush(); navigate(`/services/${id}`); }}>
                  Leave without submitting
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                  Your answers stay saved either way.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
    </>
  );
}
