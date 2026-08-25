// Workflow plan — the form modelled as an ordered graph of sections → fields, derived from
// the form DEFINITION (not the DOM). This is the source of truth the execution engine walks,
// so resume/progress are deterministic and independent of what is currently rendered.

/** Build the ordered plan from a form's sections. */
export function buildPlan(sections = []) {
  return sections.map((s, index) => ({
    index,
    title: s.title,
    fields: (s.fields || []).map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: !!f.required,
    })),
  }));
}

/** Is a field considered satisfied (filled) for its type? */
export function isFilled(value, type) {
  if (type === 'file') return !!value;
  if (Array.isArray(value)) return value.length > 0;
  if (type === 'checkbox') return value === true;
  return value != null && String(value).trim() !== '';
}

/** All data (non-document) fields across the plan. */
export function dataFields(plan) {
  return plan.flatMap((s) => s.fields).filter((f) => f.type !== 'file');
}
