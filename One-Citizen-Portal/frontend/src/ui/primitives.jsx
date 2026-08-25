import { forwardRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Tailwind component library — the prototype's visual language as React parts.
//
// Every class here comes from the `@layer components` block in src/index.css,
// which is itself built from src/theme/tokens.js. No component holds a colour,
// size or radius of its own, so a token edit changes the whole portal.
//
// These replace the MUI-styled equivalents. MUI is kept only for five
// behavioural primitives (Dialog, Drawer, Popover/Menu, Autocomplete, Stepper).
// ─────────────────────────────────────────────────────────────────────────────

/** Join class names, dropping falsy ones. */
export const cx = (...v) => v.filter(Boolean).join(' ');

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({ as: As = 'div', className, children, ...rest }) {
  return <As className={cx('oc-card', className)} {...rest}>{children}</As>;
}

/**
 * Card header: title left, optional action right. The prototype pairs every card
 * title with a "View all" link button, so that pattern is built in.
 */
export function CardHead({ title, id, action, actionLabel, onAction, level = 'h2', icon }) {
  return (
    <div className="oc-card-head">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span aria-hidden className="text-primary dark:text-d-primary flex shrink-0">{icon}</span>}
        {title && <As level={level} id={id} className="oc-card-title truncate">{title}</As>}
      </div>
      {action || (actionLabel && (
        <button type="button" className="oc-link shrink-0" onClick={onAction}>{actionLabel}</button>
      ))}
    </div>
  );
}

/** Renders a heading at the requested level so pages keep a valid outline. */
function As({ level = 'h2', children, ...rest }) {
  const Tag = level;
  return <Tag {...rest}>{children}</Tag>;
}

/** Card + header — the most common panel shape in the prototype. */
export function SectionCard({
  title, id, icon, action, actionLabel, onAction, className, bodyClassName, children, level,
}) {
  return (
    <Card className={className}>
      {(title || action || actionLabel) && (
        <CardHead title={title} id={id} icon={icon} action={action}
          actionLabel={actionLabel} onAction={onAction} level={level} />
      )}
      <div className={cx('min-w-0', bodyClassName)}>{children}</div>
    </Card>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

const BTN = {
  primary: 'oc-btn-primary',
  secondary: 'oc-btn-secondary',
  gold: 'oc-btn-gold',
  danger: 'oc-btn-danger',
};
const SIZE = { sm: 'oc-btn-sm', md: '', lg: 'oc-btn-lg' };

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', full, loading, startIcon, endIcon,
    className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(BTN[variant] || BTN.primary, SIZE[size], full && 'w-full', className)}
      {...rest}
    >
      {loading
        ? <span aria-hidden className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
        : startIcon && <span aria-hidden className="flex shrink-0">{startIcon}</span>}
      {children}
      {!loading && endIcon && <span aria-hidden className="flex shrink-0">{endIcon}</span>}
    </button>
  );
});

/** The prototype's text-only affordance, used inside card heads and rows. */
export function LinkButton({ className, children, ...rest }) {
  return <button type="button" className={cx('oc-link', className)} {...rest}>{children}</button>;
}

/** Circular icon button — the top bar's action style. */
export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        'relative grid place-items-center w-tap h-tap rounded-full text-ink shrink-0',
        'hover:bg-tint transition-colors duration-fast ease-standard',
        'dark:text-d-ink dark:hover:bg-d-tint',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────────

const TONE = {
  ok: 'oc-chip-ok',
  warn: 'oc-chip-warn',
  danger: 'oc-chip-danger',
  muted: 'oc-chip-muted',
};

/**
 * Status pill. Carries state as a DOT plus a WORD, never colour alone — that is
 * what keeps status legible for colour-blind citizens.
 */
export function Chip({ tone = 'muted', dot = true, className, children }) {
  const dotColour = {
    ok: 'bg-primary', warn: 'bg-warn', danger: 'bg-danger', muted: 'bg-muted',
  }[tone];
  return (
    <span className={cx('oc-chip', TONE[tone] || TONE.muted, className)}>
      {dot && <span aria-hidden className={cx('oc-chip-dot', dotColour)} />}
      {children}
    </span>
  );
}

// ── Service tile — the dashboard's signature element ──────────────────────────

export function ServiceTile({ icon, label, sub, onClick, href, className }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag
      {...(href ? { href } : { type: 'button', onClick })}
      className={cx('oc-tile block w-full', className)}
    >
      <span aria-hidden className="oc-tile-icon">{icon}</span>
      <span className="oc-tile-label block">{label}</span>
      {sub && <span className="block text-micro text-muted dark:text-d-muted mt-1">{sub}</span>}
    </Tag>
  );
}

// ── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, crumbs, className }) {
  return (
    <header className={cx('mb-5', className)}>
      {crumbs?.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 flex-wrap text-sm">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-muted/60">›</span>}
              {/* `primary-dark`, not `primary`. Breadcrumbs are one of the few places
                  text sits directly on the ambient mesh rather than on a glass
                  surface, so it is composited over the mesh's darkest point:
                  primary #0B6E4F measures 4.25:1 there (under AA), primary-dark
                  #095940 measures 5.68:1. On a card either would pass — this is
                  specifically the bare-backdrop case. */}
              {c.to
                ? <a href={c.to} onClick={c.onClick} className="text-muted hover:text-primary-dark dark:text-d-muted dark:hover:text-d-primary">{c.label}</a>
                : <span aria-current="page" className="font-semibold text-ink dark:text-d-ink">{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="oc-page-title">{title}</h1>
          {subtitle && <p className="oc-page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

// ── Welcome banner ───────────────────────────────────────────────────────────

/**
 * The prototype's hero: deep-green gradient with a Georgetown skyline. The
 * skyline is inline SVG rather than an image so it scales and needs no asset.
 */
export function WelcomeBanner({ title, subtitle, children }) {
  return (
    <section className="oc-banner mb-5">
      <svg
        aria-hidden
        viewBox="0 0 260 130"
        preserveAspectRatio="xMaxYMax slice"
        className="absolute right-0 bottom-0 h-full opacity-90 pointer-events-none"
      >
        <rect x="30" y="60" width="18" height="70" fill="#0C5A40" />
        <rect x="52" y="40" width="14" height="90" fill="#0A4E38" />
        <polygon points="66,40 73,10 80,40" fill="#FCD116" opacity="0.85" />
        <rect x="72" y="40" width="8" height="90" fill="#0C5A40" />
        <rect x="90" y="70" width="20" height="60" fill="#0A4E38" />
        <rect x="115" y="50" width="16" height="80" fill="#0C5A40" />
        <rect x="136" y="85" width="24" height="45" fill="#0A4E38" />
        <rect x="165" y="55" width="18" height="75" fill="#0C5A40" />
        <rect x="188" y="75" width="14" height="55" fill="#0A4E38" />
        <rect x="207" y="45" width="20" height="85" fill="#0C5A40" />
        <rect x="232" y="65" width="16" height="65" fill="#0A4E38" />
      </svg>
      <div className="relative max-w-[62%] sm:max-w-[70%]">
        <h1 className="text-banner font-bold m-0">{title}</h1>
        {subtitle && <p className="text-sm text-[#BFE3D2] mt-1.5">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}

// ── Rows ─────────────────────────────────────────────────────────────────────

/** The prototype's list row: title + sub on the left, value/date/chip right. */
export function ListRow({ title, sub, right, rightSub, onClick, className, children }) {
  const interactive = !!onClick;
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive ? { type: 'button', onClick } : {})}
      className={cx('oc-row w-full text-left', interactive && 'hover:bg-tint/50 -mx-2 px-2 rounded-btn', className)}
    >
      <div className="min-w-0 flex-1">
        {title && <div className="oc-row-title truncate">{title}</div>}
        {sub && <div className="oc-row-sub">{sub}</div>}
        {children}
      </div>
      {(right || rightSub) && (
        <div className="shrink-0 text-right">
          {right}
          {rightSub && <div className="text-sm text-muted dark:text-d-muted mt-1">{rightSub}</div>}
        </div>
      )}
    </Tag>
  );
}

/** Label / value pair — used wherever a record is shown read-only. */
export function DataRow({ label, value, strong, stack, className }) {
  const shown = value === '' || value === undefined || value === null ? '—' : value;
  if (stack) {
    return (
      <div className={cx('min-w-0', className)}>
        <dt className="text-label text-muted dark:text-d-muted">{label}</dt>
        <dd className={cx('m-0 mt-0.5 break-words', strong ? 'font-bold' : 'font-semibold')}>{shown}</dd>
      </div>
    );
  }
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-1.5 min-w-0', className)}>
      <dt className="text-sm text-muted dark:text-d-muted min-w-0">{label}</dt>
      <dd className={cx('m-0 text-sm text-right break-words min-w-0', strong ? 'font-bold' : 'font-semibold')}>{shown}</dd>
    </div>
  );
}

// ── Data table ───────────────────────────────────────────────────────────────

/**
 * The prototype's table. Wrapped in its own overflow container so a wide table
 * scrolls inside the card rather than pushing the page sideways.
 */
export function DataTable({ columns, rows, empty, getKey, className }) {
  // `rows?.length` and `rows?.map` guard against null/undefined but NOT against a
  // non-array — an endpoint answering `{ items: [...] }` where the caller expected a
  // bare array used to reach `.map` and take the whole screen down. A table is a
  // leaf: degrade to the empty state rather than white-screen the page around it.
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length && empty) return empty;
  return (
    <div className={cx('overflow-x-auto oc-scroll -mx-1', className)}>
      <table className="oc-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'right' ? 'text-right' : undefined} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={getKey ? getKey(r, i) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Screen-reader-only ───────────────────────────────────────────────────────

export function VisuallyHidden({ as: As = 'span', children }) {
  return <As className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]">{children}</As>;
}
