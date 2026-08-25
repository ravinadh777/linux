import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, Typography, Alert } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { api } from '../../lib/api.js';
import { Button } from '../../ui/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared form capabilities.
//
// Four additions to the declarative form language in ./forms/*.js, introduced for the
// Tint Waiver service but written as GENERAL capabilities every service can use. They
// are strictly additive: a form that uses none of them behaves exactly as before,
// which is what keeps the twelve existing services untouched.
//
//   max          character counter + hard cap on a text field
//   uppercase    force upper case (registration plates, chassis/VIN)
//   showWhen     conditional field — hidden AND not required when the predicate is false
//   optionsKey   option list resolved from reference data instead of a literal array
//   repeat       a whole section becomes a repeatable group stored as an array
//
// Keeping them here rather than inline in ApplyPage means the gating rules
// (`sectionComplete`, `sectionMissing`) are one implementation shared by the
// advance-gate, the review step and submit — the three places that must agree about
// whether a section is finished.
// ─────────────────────────────────────────────────────────────────────────────

// ── Conditional fields ───────────────────────────────────────────────────────

/**
 * Is this field currently in play? A field hidden by `showWhen` must never be
 * required — otherwise Next silently does nothing with no visible reason why, which
 * is the worst failure mode a stepper can have.
 */
export const isFieldActive = (f, values) => (typeof f?.showWhen !== 'function' ? true : !!f.showWhen(values || {}));

/** The fields of a section that should actually render, in order. */
export const visibleFields = (section, values) => (section?.fields || []).filter((f) => isFieldActive(f, values));

// ── Repeatable sections ──────────────────────────────────────────────────────

export const isRepeatSection = (section) => !!section?.repeat;

/** A blank row for a repeat section. */
export const blankRow = (section) =>
  Object.fromEntries((section?.fields || []).map((f) => [f.name, f.type === 'multiselect' ? [] : f.type === 'checkbox' ? false : '']));

/**
 * Every field the FORM registers with react-hook-form.
 *
 * Repeat sections are excluded on purpose: their fields live inside an array under
 * `section.repeat.name`, not as top-level keys. Registering them flat would make RHF
 * validate a `registrationNumber` that does not exist at the top level and block the
 * form forever.
 */
export const topLevelFields = (form) =>
  (form?.sections || []).filter((s) => !isRepeatSection(s)).flatMap((s) => s.fields || []);

/** Names of the array keys a form stores repeat rows under (e.g. ['vehicles']). */
export const repeatKeys = (form) =>
  (form?.sections || []).filter(isRepeatSection).map((s) => s.repeat.name);

// ── Completion ───────────────────────────────────────────────────────────────

/**
 * Is one field satisfied? `docMeta` is consulted for file fields so an uploaded
 * document counts even before RHF's value has settled — the two can otherwise
 * disagree and produce a false block.
 */
export function isFieldComplete(f, values, docMeta = {}) {
  if (!f) return true;
  if (!f.required || !isFieldActive(f, values)) return true;
  const v = values?.[f.name];
  if (f.type === 'file') return !!docMeta[f.name] || !!v;
  if (Array.isArray(v)) return v.length > 0;
  if (f.type === 'checkbox') return v === true;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/** Is a whole section satisfied, including every row of a repeat group? */
export function sectionComplete(section, values, docMeta = {}) {
  // Null-safe on purpose. The stepper addresses sections by index, and the LAST index
  // is the synthetic "Review & submit" step which has no section object — so
  // `sections[activeStep]` is legitimately undefined there. A resumed draft can also
  // point at a step a shortened form no longer has. Treating "no section" as complete
  // is right: there is nothing in it left to fill.
  if (!section) return true;
  if (isRepeatSection(section)) {
    const rows = values?.[section.repeat.name] || [];
    if (rows.length < (section.repeat.min || 1)) return false;
    return rows.every((row) => (section.fields || []).every((f) => isFieldComplete(f, row, docMeta)));
  }
  return (section.fields || []).every((f) => isFieldComplete(f, values, docMeta));
}

/** Human labels of what is still outstanding — drives the blocking message. */
export function sectionMissing(section, values, docMeta = {}) {
  if (!section) return [];
  if (isRepeatSection(section)) {
    const out = [];
    (values?.[section.repeat.name] || []).forEach((row, i) => {
      (section.fields || []).forEach((f) => {
        if (!isFieldComplete(f, row, docMeta)) out.push(`${section.repeat.itemLabel || 'Item'} ${i + 1} — ${f.label}`);
      });
    });
    return out;
  }
  return (section.fields || [])
    .filter((f) => !isFieldComplete(f, values, docMeta))
    .map((f) => f.label);
}

// ── Reference-backed option lists ────────────────────────────────────────────

/**
 * Resolve `optionsKey` against reference data served from the DB.
 *
 * Option lists live in Postgres (seeded from data/seed/reference/*.json) rather than
 * hardcoded in a form file, for the same reason regions and document types do: a
 * government value list changes without a frontend release.
 *
 * `configured` is the load-bearing part. The MOHA Tint API publishes no lookup
 * endpoints, so a list may legitimately be EMPTY until it is supplied. A select whose
 * list is not configured renders disabled with an explanation and blocks that field,
 * instead of showing an empty dropdown that reads as a broken page. It never
 * substitutes a plausible guess — an invented exemption category would be submitted
 * to a real ministry on a real citizen's application.
 */
export function useFormOptions() {
  const q = useQuery({
    queryKey: ['reference', 'tint'],
    queryFn: () => api.get('/reference/tint').then((r) => r.data),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  return useMemo(() => {
    const d = q.data || {};
    const makes = Array.isArray(d.vehicleMakes) ? d.vehicleMakes : [];
    return {
      isLoading: q.isLoading,
      lists: {
        exemptionCategories: d.exemptionCategories || [],
        medicalConditions: d.medicalConditions || [],
        vehicleTypes: d.vehicleTypes || [],
        vehicleColours: d.vehicleColours || [],
        vehicleYears: d.vehicleYears || [],
        // The make catalogue is [{ make, models: [] }]; the select needs names.
        vehicleMakes: makes.map((m) => m.make).filter(Boolean),
      },
      configured: d.configured || {},
      /** Models for the currently chosen make — powers `dependsOn`. */
      modelsFor: (make) => {
        if (!make) return [];
        const hit = makes.find((m) => String(m.make).toLowerCase() === String(make).toLowerCase());
        return hit?.models || [];
      },
    };
  }, [q.data, q.isLoading]);
}

/**
 * The options a single field should offer, plus whether its source is configured.
 * @returns {{options: string[], configured: boolean, dependencyUnmet: boolean}}
 */
export function optionsForField(f, values, formOptions) {
  if (Array.isArray(f.options)) return { options: f.options, configured: true, dependencyUnmet: false };
  if (!f.optionsKey) return { options: [], configured: true, dependencyUnmet: false };

  if (f.optionsKey === 'vehicleModels') {
    const make = values?.[f.dependsOn || 'vehicleMake'];
    return {
      options: formOptions.modelsFor(make),
      // Models are configured exactly when makes are — they come from one catalogue.
      configured: formOptions.configured.vehicleMakes ?? false,
      dependencyUnmet: !make,
    };
  }
  return {
    options: formOptions.lists[f.optionsKey] || [],
    configured: formOptions.configured[f.optionsKey] ?? ((formOptions.lists[f.optionsKey] || []).length > 0),
    dependencyUnmet: false,
  };
}

// ── Repeat group renderer ────────────────────────────────────────────────────

/**
 * Renders a repeatable section as a list of cards with add/remove.
 *
 * The last row cannot be removed (`min`): an application with zero vehicles is
 * meaningless, and hiding the control is clearer than letting them click it and get
 * an error.
 *
 * @param {object}   p
 * @param {object}   p.section    the section definition (must have `repeat`)
 * @param {object[]} p.rows
 * @param {Function} p.onChange   (rows) => void
 * @param {Function} p.renderRowField  (field, rowIndex, row) => ReactNode
 * @param {object}   p.values     whole form, for `inherit`
 * @param {string[][]} [p.rowMissing]  per-row outstanding labels, when showing errors
 */
export function RepeatGroup({ section, rows, onChange, renderRowField, values, rowMissing = [] }) {
  const { itemLabel = 'Item', min = 1, inherit = {} } = section.repeat;

  const addRow = () => {
    const row = blankRow(section);
    // Carry declared fields forward from the parent form (e.g. registeredOwner
    // defaults to the organisation name) so a fleet does not retype them. Editable.
    for (const [target, source] of Object.entries(inherit)) {
      if (values?.[source]) row[target] = values[source];
    }
    onChange([...(rows || []), row]);
  };

  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-4">
      {(rows || []).map((row, i) => (
        <div key={i} className="oc-glass rounded-card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <Typography variant="subtitle2" component="h4" sx={{ fontWeight: 700 }}>
              {itemLabel} {i + 1}
              {row.registrationNumber ? ` — ${row.registrationNumber}` : ''}
            </Typography>
            {rows.length > min && (
              <Button variant="secondary" size="sm" onClick={() => removeRow(i)}
                startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />}
                aria-label={`Remove ${itemLabel} ${i + 1}`}>
                Remove
              </Button>
            )}
          </div>

          {rowMissing[i]?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Still needed: {rowMissing[i].join(', ')}.
            </Alert>
          )}

          <Grid container spacing={2}>
            {(section.fields || []).map((f) => (
              <Grid item xs={12} sm={f.fullWidth ? 12 : 6} key={f.name}>
                {renderRowField(f, i, row)}
              </Grid>
            ))}
          </Grid>
        </div>
      ))}

      <div>
        <Button variant="secondary" onClick={addRow} startIcon={<AddRoundedIcon />}>
          Add another {String(itemLabel).toLowerCase()}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {rows?.length || 0} {(rows?.length || 0) === 1 ? String(itemLabel).toLowerCase() : `${String(itemLabel).toLowerCase()}s`} on this application.
        </Typography>
      </div>
    </div>
  );
}
