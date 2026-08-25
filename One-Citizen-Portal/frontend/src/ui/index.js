// ─────────────────────────────────────────────────────────────────────────────
// The oneCitizen UI library — the approved prototype's visual language, in
// Tailwind. Every screen imports from here; no screen writes its own colours,
// radii or type sizes.
//
//   import { Card, SectionCard, Button, StatusChip, DataTable } from '@/ui';
//
// Styling source of truth: src/theme/tokens.js → tailwind.config.js + the
// @layer components block in src/index.css.
// ─────────────────────────────────────────────────────────────────────────────

export {
  cx,
  Card, CardHead, SectionCard,
  Button, LinkButton, IconButton,
  Chip,
  ServiceTile,
  PageHeader, WelcomeBanner,
  ListRow, DataRow,
  DataTable,
  VisuallyHidden,
} from './primitives.jsx';

export {
  Skeleton, ListSkeleton, TileSkeleton, GridSkeleton, TableSkeleton, FormSkeleton,
  Loading, EmptyState, ErrorState, SuccessState, DataView,
} from './states.jsx';

export { StatusChip } from './StatusChip.jsx';
export { Field, TextField, SelectField, CheckboxField } from './Field.jsx';
