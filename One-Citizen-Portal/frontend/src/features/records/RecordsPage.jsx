import { useState } from 'react';
import { Dialog } from '@mui/material';
import {
  PageHeader, SectionCard, Button, DataTable, EmptyState, ErrorState,
  TableSkeleton, StatusChip, Chip, cx,
} from '../../ui/index.js';
import { TextField, SelectField, CheckboxField } from '../../ui/Field.jsx';
import { useRecords } from './useRecords.js';

// ─────────────────────────────────────────────────────────────────────────────
// Generic record screen — drives Vehicles, Properties, Employment, Family and
// Wallet from a per-collection CONFIG rather than five near-identical pages.
//
// Each config declares its columns, its form fields and its copy; everything else
// (loading, empty, error, add/edit dialog, delete confirm, validation display) is
// implemented once here. That is what keeps five screens visually identical and
// means a fix lands on all of them.
//
// The add/edit dialog uses MUI's Dialog purely for its focus trap and aria wiring —
// one of the five behavioural primitives we kept. Everything inside is Tailwind.
// ─────────────────────────────────────────────────────────────────────────────

export default function RecordsPage({ config }) {
  const { collection, title, subtitle, columns, fields, addLabel, emptyTitle, emptyHint, icon, readOnly } = config;
  const { items, isLoading, error, refetch, create, update, remove, saving } = useRecords(collection);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [touched, setTouched] = useState({});

  const startAdd = () => { setEditing(null); setForm({}); setTouched({}); setOpen(true); };
  const startEdit = (row) => {
    setEditing(row);
    setForm(Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? ''])));
    setTouched({});
    setOpen(true);
  };

  const set = (key) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
  };
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  const errorFor = (f) => {
    if (!touched[f.key]) return '';
    const v = form[f.key];
    if (f.required && (v === '' || v === undefined || v === null)) return `${f.label} is required.`;
    if (f.pattern && v && !new RegExp(f.pattern).test(String(v))) return f.patternHint || `Check the format of ${f.label.toLowerCase()}.`;
    return '';
  };

  const firstInvalid = fields.find((f) => f.required && !form[f.key]);

  const submit = (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(fields.map((f) => [f.key, true])));
    if (firstInvalid) {
      document.getElementsByName(firstInvalid.key)?.[0]?.focus?.();
      return;
    }
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    );
    const done = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  };

  // The row actions column is appended to whatever the config declares.
  const allColumns = [
    ...columns,
    ...(readOnly ? [] : [{
      key: '__actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>Edit</Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-danger-text hover:border-danger"
            onClick={() => {
              // eslint-disable-next-line no-alert
              if (window.confirm(`Remove this ${title.toLowerCase().replace(/s$/, '')}?`)) remove.mutate(row.id);
            }}
          >
            Remove
          </Button>
        </div>
      ),
    }]),
  ];

  return (
    <div className="w-full">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={!readOnly && (
          <Button onClick={startAdd} startIcon={<Plus />}>{addLabel}</Button>
        )}
      />

      <SectionCard title={items.length ? `${items.length} on record` : undefined}>
        {isLoading ? <TableSkeleton rows={4} cols={columns.length} />
          : error ? <ErrorState error={error} title={`Could not load your ${title.toLowerCase()}`} onRetry={refetch} />
          : items.length === 0 ? (
            <EmptyState
              icon={icon}
              title={emptyTitle}
              hint={emptyHint}
              action={!readOnly && <Button onClick={startAdd}>{addLabel}</Button>}
            />
          ) : (
            <DataTable columns={allColumns} rows={items} getKey={(r) => r.id} />
          )}
      </SectionCard>

      {/* ── Add / edit ────────────────────────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth aria-labelledby="record-dialog-title">
        <form onSubmit={submit} noValidate>
          <div className="p-5 sm:p-6">
            <h2 id="record-dialog-title" className="oc-page-title">
              {editing ? `Edit ${title.toLowerCase().replace(/s$/, '')}` : addLabel}
            </h2>
            <p className="oc-page-sub mb-5">
              {editing
                ? 'Update the details below. Changes are saved to your record.'
                : 'These details are saved to your own record and reused when you apply for a service.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.key} className={cx(f.full && 'sm:col-span-2')}>
                  {f.type === 'select' ? (
                    <SelectField
                      name={f.key} label={f.label} required={f.required}
                      value={form[f.key] ?? ''} onChange={set(f.key)} onBlur={blur(f.key)}
                      options={f.options} error={errorFor(f)} help={f.help}
                      placeholder={f.placeholder || 'Choose…'}
                    />
                  ) : f.type === 'checkbox' ? (
                    <CheckboxField
                      name={f.key} label={f.label}
                      checked={!!form[f.key]} onChange={set(f.key)} help={f.help}
                    />
                  ) : (
                    <TextField
                      name={f.key} label={f.label} type={f.type || 'text'} required={f.required}
                      value={form[f.key] ?? ''} onChange={set(f.key)} onBlur={blur(f.key)}
                      placeholder={f.placeholder} error={errorFor(f)} help={f.help}
                      inputMode={f.inputMode} maxLength={f.maxLength}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>
                {editing ? 'Save changes' : 'Add to my records'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function Plus() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 4v10M4 9h10" />
    </svg>
  );
}

// Shared cell renderers, so every screen formats the same kinds of value identically.
export const cell = {
  strong: (k) => (r) => <span className="font-bold">{r[k] || '—'}</span>,
  text: (k) => (r) => r[k] || '—',
  money: (k) => (r) => (
    <span className="tabular-nums">
      {r[k] ? `$${Number(r[k]).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
    </span>
  ),
  date: (k) => (r) => r[k] || '—',
  status: (k) => (r) => (r[k] ? <StatusChip status={r[k]} /> : '—'),
  flag: (k, label) => (r) => (r[k] ? <Chip tone="ok" dot={false}>{label}</Chip> : '—'),
};
