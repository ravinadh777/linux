import { cx, Card, Button } from './primitives.jsx';
import { apiError } from '../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Loading · empty · error · success, in the prototype's language.
//
// Skeletons rather than spinners: a skeleton communicates the SHAPE of what is
// arriving, so the page does not jump when it lands. This matters on the variable
// connections the portal is actually used over.
//
// The prototype ships an `.empty-state` block but no loading or error treatment —
// those are extrapolated from its card, tint and muted tokens.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shimmering placeholder block. The sweep is a ::after pseudo-element rather than
 * a background animation so it costs one composited transform instead of
 * repainting the element on every frame — noticeable on the low-end phones this
 * portal targets. Suppressed under prefers-reduced-motion (see index.css).
 */
export function Skeleton({ className, rounded = 'rounded-btn', style }) {
  return (
    <span
      aria-hidden
      style={style}
      className={cx(
        'block bg-tint dark:bg-d-tint relative overflow-hidden oc-shimmer', rounded, className,
      )}
    />
  );
}

/** Rows of avatar + two lines + trailing control — lists, deadlines, documents. */
export function ListSkeleton({ rows = 3, avatar = true }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {avatar && <Skeleton className="w-[38px] h-[38px] shrink-0" rounded="rounded-full" />}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Skeleton className="h-3.5" style={{ width: `${70 - i * 8}%` }} />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="w-16 h-8 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Tile grid placeholder — the dashboard's services block. */
export function TileSkeleton({ count = 5 }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-line dark:border-d-line rounded-tile p-3.5 flex flex-col items-center gap-2">
          <Skeleton className="w-[42px] h-[42px]" rounded="rounded-tile" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Card grid placeholder — agencies, services, tracking. */
export function GridSkeleton({ count = 6, cols = 'sm:grid-cols-2 lg:grid-cols-3' }) {
  return (
    <div className={cx('grid gap-[18px] grid-cols-1', cols)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-[42px] h-[42px] shrink-0" rounded="rounded-tile" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Table placeholder — applications, documents, payments. */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cx('h-3.5', c === 0 ? 'w-4/5' : 'w-3/5')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Form placeholder — label + field pairs. */
export function FormSkeleton({ fields = 6 }) {
  return (
    <div className="grid gap-[18px] grid-cols-1 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-input" />
        </div>
      ))}
    </div>
  );
}

const VARIANTS = { list: ListSkeleton, tile: TileSkeleton, grid: GridSkeleton, table: TableSkeleton, form: FormSkeleton };

/**
 * Loading state. `label` is announced to assistive tech via a live region, so a
 * screen-reader user is told the page is working rather than met with silence.
 */
export function Loading({ variant = 'list', label = 'Loading…', ...rest }) {
  const V = VARIANTS[variant] || ListSkeleton;
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="absolute w-px h-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]">{label}</span>
      <V {...rest} />
    </div>
  );
}

/**
 * Empty state. Never a bare void: says what belongs here, why it is empty, and
 * what to do next. This is the prototype's `.empty-state`, given an action slot.
 */
export function EmptyState({ title = 'Nothing here yet', hint, action, icon, className }) {
  return (
    <div className={cx('oc-empty', className)}>
      {icon && <div aria-hidden className="oc-empty-icon dark:bg-d-tint dark:text-d-primary">{icon}</div>}
      <h4>{title}</h4>
      {hint && <p>{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Error state. Says what failed, what to do, and reassures that nothing was lost.
 */
export function ErrorState({ error, title = 'We could not load this', onRetry, reassure = true, className }) {
  return (
    <div
      role="alert"
      className={cx('rounded-tile border border-danger/30 bg-danger-tint text-danger-text p-4 my-3', className)}
    >
      <p className="font-bold">{title}</p>
      <p className="text-sm mt-1">{apiError(error)}</p>
      {reassure && (
        <p className="text-sm mt-1 opacity-90">
          Check your connection and try again. Nothing you have saved has been lost.
        </p>
      )}
      {onRetry && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

/** Success confirmation, used after a submit or save. */
export function SuccessState({ title, children, className }) {
  return (
    <div role="status" className={cx('rounded-tile border border-primary/25 bg-ok-tint text-ok-text p-4 my-3', className)}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className="text-sm mt-1">{children}</div>}
    </div>
  );
}

/**
 * Resolves the whole loading → error → empty → content sequence in one place, so
 * no screen re-implements the ordering and none can forget the empty case (which
 * is how the original app ended up with blank panels on five screens).
 */
export function DataView({
  isLoading, error, isEmpty, onRetry, loadingVariant = 'list', loadingProps, empty, errorTitle, children,
}) {
  if (isLoading) return <Loading variant={loadingVariant} {...loadingProps} />;
  if (error) return <ErrorState error={error} title={errorTitle} onRetry={onRetry} />;
  if (isEmpty) return empty || <EmptyState />;
  return children;
}
