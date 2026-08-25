import { useState } from 'react';
import { Box, Typography, Breadcrumbs, Link, Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import GuyanaCrest from './GuyanaCrest.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Shell-level UI: brand mark and page header.
//
// This file is also the single barrel every screen imports from, so state and
// primitive components are re-exported below. That matters because the codebase
// previously had TWO competing sets: `Loading`/`ErrorState` existed in both
// components/ui.jsx and components/PageState.jsx, and `PageState` also exported
// a `PageTitle` that duplicated `PageHeader`. PageState.jsx was imported by
// nothing and has been deleted.
// ─────────────────────────────────────────────────────────────────────────────

export {
  Loading, EmptyState, ErrorState, SuccessState, DataView,
  CardSkeleton, ListSkeleton, GridSkeleton, FormSkeleton,
} from './states.jsx';

export {
  StatusChip, DataRow, SectionHeader, SectionCard, StepProgress, StepLink, VisuallyHidden,
} from './primitives.jsx';

// Wordmark + crest fallback, used when the official logo image is absent or on
// dark surfaces (the official mark has dark text and would disappear there).
function BrandMark({ compact, light }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="start">
      <GuyanaCrest size={compact ? 34 : 42} />
      {!compact && (
        <Box sx={{ lineHeight: 1 }}>
          <Typography
            component="span"
            sx={{
              display: 'block', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em',
              color: light ? 'rgba(255,255,255,.82)' : 'text.secondary',
            }}
          >
            GOVERNMENT OF GUYANA
          </Typography>
          <Typography variant="h6" component="span" sx={{ display: 'block', lineHeight: 1.15, color: light ? '#fff' : 'text.primary' }}>
            one<Box component="span" sx={{ color: light ? '#90CAF9' : 'primary.main' }}>Citizen</Box>
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

/**
 * Renders the official Guyana logo from /brand/guyana-logo.png when present,
 * otherwise the crest + wordmark.
 */
export function Brand({ compact = false, light = false }) {
  const [imgOk, setImgOk] = useState(true);
  if (light || !imgOk) return <BrandMark compact={compact} light={light} />;
  return (
    <Box
      component="img"
      src="/brand/guyana-logo.png"
      alt="Government of Guyana — oneCitizen"
      onError={() => setImgOk(false)}
      sx={{ height: compact ? 34 : 54, width: 'auto', display: 'block' }}
    />
  );
}

/**
 * Page header: breadcrumbs, title, supporting line, optional actions.
 *
 * The title is the page's only `h1`, which gives every screen a correct heading
 * outline — previously titles were `variant="h4"` with no element mapping, so a
 * screen reader user got no page-level landmark to jump to.
 */
export function PageHeader({ title, subtitle, crumbs = [], actions }) {
  return (
    <Box component="header" sx={{ mb: { xs: 2.5, md: 3 } }}>
      {crumbs.length > 0 && (
        <Breadcrumbs
          aria-label="Breadcrumb"
          separator={<NavigateNextRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ mb: 1.25, '& .MuiBreadcrumbs-separator': { mx: 0.75, color: 'text.disabled' } }}
        >
          {crumbs.map((c, i) =>
            c.to ? (
              <Link key={i} component={RouterLink} to={c.to} color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {c.label}
              </Link>
            ) : (
              // The current page: marked aria-current and not a link.
              <Typography key={i} component="span" aria-current="page" color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {c.label}
              </Typography>
            ),
          )}
        </Breadcrumbs>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        spacing={{ xs: 1.5, sm: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1">{title}</Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, maxWidth: '68ch' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Stack>
    </Box>
  );
}

export { Button };
