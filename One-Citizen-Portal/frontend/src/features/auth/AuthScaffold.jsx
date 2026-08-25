import { useState } from 'react';
import { Box, Typography, Stack, Button, Tooltip } from '@mui/material';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import FormatSizeRoundedIcon from '@mui/icons-material/FormatSizeRounded';
import GuyanaCrest from '../../components/GuyanaCrest.jsx';
import { useUiStore } from '../../stores/uiStore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared chrome for the sign-in and sign-up pages: the branded panel, the utility
// row, and the footer. Both pages previously carried near-identical copies of all
// three (~70 duplicated lines each), which is why they had drifted apart —
// different field sizes, different panel widths.
//
// The utility row is where the honesty fixes live. It used to present four
// controls that did nothing: an A−/A/A+ text-size switcher, a language selector
// with a pointer cursor, an accessibility icon, and a "Forgot password?" link
// pointing at href="#". On a government sign-in page a dead accessibility
// control is worse than no control — the citizens most likely to press it are
// the ones who most need it to work. Text size is now real; the placeholders are
// gone until they do something.
// ─────────────────────────────────────────────────────────────────────────────

const HIGHLIGHTS = [
  { icon: <VerifiedUserRoundedIcon />, title: 'One sign-in for everything', text: 'Reach every ministry service with a single account.' },
  { icon: <BoltRoundedIcon />, title: 'Tell us once', text: 'Your verified details and documents are reused across government.' },
  { icon: <AutoAwesomeRoundedIcon />, title: 'AskGov helps you apply', text: 'It drafts your forms from your saved details. You always confirm.' },
];

/** Real text-size control, wired to the type scale via the UI store. */
function TextSizeControl() {
  const textScale = useUiStore((s) => s.textScale);
  const setTextScale = useUiStore((s) => s.setTextScale);
  const OPTIONS = [
    { value: 1, label: 'A', hint: 'Normal text size' },
    { value: 1.15, label: 'A+', hint: 'Larger text' },
    { value: 1.3, label: 'A++', hint: 'Largest text' },
  ];
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <FormatSizeRoundedIcon aria-hidden sx={{ fontSize: 18, color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>Text size</Typography>
      <Stack direction="row" spacing={0.5} role="group" aria-label="Text size">
        {OPTIONS.map((o) => {
          const active = textScale === o.value;
          return (
            <Tooltip key={o.value} title={o.hint}>
              <Button
                size="small"
                onClick={() => setTextScale(o.value)}
                aria-pressed={active}
                sx={{
                  minWidth: 40, minHeight: 36, px: 1, fontWeight: 700,
                  bgcolor: active ? 'primary.subtle' : 'transparent',
                  color: active ? 'primary.onSubtle' : 'text.secondary',
                  border: 1, borderColor: active ? 'primary.main' : 'divider',
                }}
              >
                {o.label}
              </Button>
            </Tooltip>
          );
        })}
      </Stack>
    </Stack>
  );
}

/**
 * The branded panel. On mobile it now carries the actual value proposition —
 * previously the whole message was `display: { xs: 'none', md: 'block' }`, so
 * phone users got a 200px empty blue band with a logo and nothing else, on the
 * exact devices most citizens use.
 */
function BrandPanel({ heading, blurb, flex }) {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <Box
      sx={{
        flex, position: 'relative', overflow: 'hidden',
        background: (t) => t.gradients.hero, color: '#fff',
        p: { xs: 3, sm: 5, md: 6, lg: 8 },
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 3,
      }}
    >
      <Box aria-hidden sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(650px circle at 85% 10%, rgba(255,255,255,.14), transparent 45%), radial-gradient(520px circle at 5% 95%, rgba(255,255,255,.10), transparent 45%)',
      }} />

      <Box sx={{ position: 'relative' }}>
        {logoOk ? (
          <Box sx={{ display: 'inline-flex', bgcolor: '#fff', borderRadius: 2, p: 1.25 }}>
            <Box component="img" src="/brand/guyana-logo.png" alt="Government of Guyana — oneCitizen"
              onError={() => setLogoOk(false)} sx={{ height: { xs: 34, md: 54 }, width: 'auto', display: 'block' }} />
          </Box>
        ) : (
          <GuyanaCrest size={52} />
        )}
      </Box>

      <Box sx={{ position: 'relative', maxWidth: 560 }}>
        <Typography variant="h3" component="p" sx={{ mb: { xs: 1, md: 2 } }}>{heading}</Typography>
        {/* Shown at every breakpoint now, tightened on mobile rather than removed. */}
        <Typography sx={{ opacity: 0.92, fontSize: { xs: '0.9375rem', md: '1.125rem' }, mb: { xs: 0, md: 5 } }}>
          {blurb}
        </Typography>
        <Stack spacing={2.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {HIGHLIGHTS.map((h) => (
            <Stack key={h.title} direction="row" spacing={2} alignItems="flex-start">
              <Box aria-hidden sx={{ p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {h.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>{h.title}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.88 }}>{h.text}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Typography variant="caption" sx={{ position: 'relative', opacity: 0.85, letterSpacing: '0.12em', display: { xs: 'none', md: 'block' } }}>
        ONE PEOPLE · ONE NATION · ONE DESTINY
      </Typography>
    </Box>
  );
}

/**
 * Two-column auth shell. `panelFlex` / `formFlex` let sign-in favour the brand
 * panel and sign-up favour the (longer) form.
 */
export default function AuthScaffold({
  heading, blurb, panelFlex = '1 1 56%', formFlex = '1 1 44%', maxWidth = 440, children,
}) {
  return (
    // No `minHeight` and no `overflowX` here — AuthLayout owns the viewport height, and
    // this element setting it again is what produced two vertical scrollbars on the
    // registration form. `flexGrow: 1` fills whatever AuthLayout gives it instead.
    <Box sx={{ flexGrow: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      <BrandPanel heading={heading} blurb={blurb} flex={{ md: panelFlex }} />

      <Box sx={{ flex: { md: formFlex }, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ px: { xs: 2, sm: 4 }, py: 1.5 }}>
          <TextSizeControl />
        </Stack>

        {/* `overflowY: 'auto'` removed. It made this column its own scroll container, so
            the long registration form scrolled INSIDE the column while the page scrolled
            too — two bars side by side. The page is now the only vertical scroller.
            `justifyContent` centres the short sign-in form but lets the taller sign-up
            form start at the top and simply extend the page. */}
        <Box sx={{
          flexGrow: 1, display: 'flex', minWidth: 0,
          alignItems: 'flex-start', justifyContent: 'center',
          px: { xs: 2.5, sm: 6 }, py: 4,
        }}>
          <Box sx={{ width: '100%', maxWidth, my: { md: 'auto' } }}>{children}</Box>
        </Box>

        <Stack spacing={1} sx={{ px: 2, py: 2.5, alignItems: 'center' }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
            <ShieldRoundedIcon aria-hidden sx={{ fontSize: 16 }} />
            <Typography variant="caption">Secured by OneIdentity</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" align="center">
            © {new Date().getFullYear()} Co-operative Republic of Guyana
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
