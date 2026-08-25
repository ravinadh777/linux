import { useId } from 'react';
import { cx } from './primitives.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Form fields in the prototype's language.
//
// Plain HTML inputs, not MUI — the prototype's inputs are plain, and MUI's
// OutlinedInput brings a notched-fieldset label that fights this design. Native
// elements also give correct mobile keyboards and autofill for free.
//
// Every field wires label ↔ control ↔ help/error with real ids, so the error text
// is announced rather than only shown in red.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Field shell: label, control, help/error. Use directly when wrapping a custom
 * control; otherwise use TextField / SelectField below.
 */
export function Field({ label, htmlFor, required, error, help, className, children, hideLabel }) {
  const describedBy = error ? `${htmlFor}-error` : help ? `${htmlFor}-help` : undefined;
  return (
    <div className={cx('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className={cx('oc-label', hideLabel && 'sr-only')}>
          {label}
          {required && (
            <>
              <span aria-hidden className="text-danger ml-0.5">*</span>
              <span className="absolute w-px h-px overflow-hidden [clip:rect(0,0,0,0)]"> (required)</span>
            </>
          )}
        </label>
      )}
      {typeof children === 'function' ? children({ id: htmlFor, describedBy }) : children}
      {error
        ? <p id={`${htmlFor}-error`} className="oc-help-error">{error}</p>
        : help ? <p id={`${htmlFor}-help`} className="oc-help">{help}</p> : null}
    </div>
  );
}

/** Text / email / tel / date / number / password input. */
export function TextField({
  label, value, onChange, onBlur, error, help, required, type = 'text',
  placeholder, name, id, disabled, autoComplete, inputMode, maxLength, pattern,
  multiline, rows = 3, className, hideLabel, ...rest
}) {
  const auto = useId();
  const fieldId = id || name || auto;
  const Control = multiline ? 'textarea' : 'input';
  return (
    <Field label={label} htmlFor={fieldId} required={required} error={error} help={help}
      className={className} hideLabel={hideLabel}>
      {({ describedBy }) => (
        <Control
          id={fieldId}
          name={name}
          {...(multiline ? { rows } : { type })}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          pattern={pattern}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx('oc-input', multiline && 'min-h-[96px] py-3 resize-y', error && 'oc-input-error')}
          {...rest}
        />
      )}
    </Field>
  );
}

/** Native select — correct wheel picker on mobile, no JS dropdown to maintain. */
export function SelectField({
  label, value, onChange, onBlur, error, help, required, name, id, disabled,
  options = [], placeholder = 'Choose…', className, hideLabel,
}) {
  const auto = useId();
  const fieldId = id || name || auto;
  return (
    <Field label={label} htmlFor={fieldId} required={required} error={error} help={help}
      className={className} hideLabel={hideLabel}>
      {({ describedBy }) => (
        <select
          id={fieldId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx('oc-input appearance-none pr-10 bg-no-repeat', error && 'oc-input-error')}
          style={{
            // Inline chevron so the control needs no icon font or wrapper element.
            backgroundImage:
              "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='9' viewBox='0 0 14 9'%3E%3Cpath d='M1 1l6 6 6-6' stroke='%2355655C' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
            backgroundPosition: 'right 14px center',
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const lbl = typeof o === 'string' ? o : o.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      )}
    </Field>
  );
}

/** Checkbox with the label as its hit area. */
export function CheckboxField({ label, checked, onChange, name, id, error, help, disabled, className }) {
  const auto = useId();
  const fieldId = id || name || auto;
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={fieldId} className="flex items-start gap-2.5 cursor-pointer min-h-tap py-1">
        <input
          id={fieldId}
          name={name}
          type="checkbox"
          checked={!!checked}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="w-[18px] h-[18px] mt-0.5 shrink-0 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="text-base">{label}</span>
      </label>
      {error
        ? <p id={`${fieldId}-error`} className="oc-help-error">{error}</p>
        : help ? <p className="oc-help">{help}</p> : null}
    </div>
  );
}
