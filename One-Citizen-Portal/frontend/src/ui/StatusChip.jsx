import { Chip } from './primitives.jsx';
import { statusColor, statusLabel } from '../theme/theme.js';

// Maps the MUI-era tone names the status vocabulary already returns onto the
// prototype's four chip tones. Kept as a separate module so the status vocabulary
// (theme.js) stays the single place that decides what a status MEANS, while this
// file only decides how it LOOKS.
const TONE = {
  success: 'ok',
  info: 'ok',
  warning: 'warn',
  error: 'danger',
  default: 'muted',
};

/**
 * Status pill for an application, appointment or payment.
 *
 * Every status string in the app keeps its existing meaning — `statusColor` and
 * `statusLabel` are untouched. This only renders them in the prototype's chip.
 */
export function StatusChip({ status, className }) {
  if (!status) return null;
  return (
    <Chip tone={TONE[statusColor(status)] || 'muted'} className={className}>
      {statusLabel(status)}
    </Chip>
  );
}
