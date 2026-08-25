import { createTheme } from '@mui/material/styles';
import {
  BRAND, SEMANTIC, RADIUS, MOTION, LAYOUT, TYPE, SHADOW, Z,
  FONT_STACK, surfaceFor, gradients, glassFor, glassShadowFor,
} from './tokens.js';

// ─────────────────────────────────────────────────────────────────────────────
// MUI bridge.
//
// Tailwind is the styling system (see tailwind.config.js + index.css). MUI is
// retained ONLY for five behavioural primitives whose accessibility would be
// costly and risky to rebuild by hand: Dialog (focus trap + aria), Drawer,
// Popover/Menu (collision-aware positioning), Autocomplete (combobox semantics)
// and Stepper.
//
// This theme exists for two reasons:
//   1. those primitives still read `theme.palette` internally, so it must carry
//      the prototype's colours rather than MUI's defaults;
//   2. it keeps screens that have not yet been migrated to Tailwind on-brand
//      during the rollout, instead of leaving them blue.
//
// Every value comes from ./tokens.js — the same module tailwind.config.js
// imports — so the two systems cannot diverge.
// ─────────────────────────────────────────────────────────────────────────────

export const GRADIENTS = gradients('light');

/**
 * @param {'light'|'dark'} mode
 * @param {number} [textScale] 1 – 1.3, from the A / A+ / A++ control.
 */
export function buildTheme(mode, textScale = 1) {
  const dark = mode === 'dark';
  const s = surfaceFor(mode);
  const grad = gradients(mode);
  // The glass vocabulary, so MUI-rendered surfaces are the SAME material as the
  // Tailwind ones. Without this the app would have two card looks side by side:
  // frosted `.oc-card` panels on the screens already migrated to Tailwind, and flat
  // opaque MUI `<Card>`s on the ~15 that still use MUI — which is exactly the
  // per-screen inconsistency a shared design system exists to prevent.
  const g = glassFor(mode);
  const gShadow = glassShadowFor(mode);
  const scale = Math.min(1.3, Math.max(1, Number(textScale) || 1));
  // Tokens are px; MUI wants rem-ish strings. 16px root.
  const fs = (pxSize) => `${((pxSize * scale) / 16).toFixed(4)}rem`;

  const focusRing = {
    outline: `2px solid ${dark ? s.primary : BRAND.primary}`,
    outlineOffset: 2,
  };

  return createTheme({
    palette: {
      mode,
      primary: {
        main: dark ? s.primary : BRAND.primary,
        dark: BRAND.primaryDark,
        deep: BRAND.primaryDeep,
        contrastText: dark ? '#07281E' : '#ffffff',
        subtle: s.tint,
        onSubtle: dark ? s.primary : BRAND.primaryDark,
      },
      secondary: {
        main: BRAND.gold,
        dark: BRAND.goldHover,
        contrastText: SEMANTIC.ok.main === BRAND.primary ? '#1F2A24' : '#1F2A24',
        subtle: SEMANTIC.warn.tint,
        onSubtle: BRAND.goldText,
      },
      success: { main: SEMANTIC.ok.main, text: SEMANTIC.ok.text, subtle: SEMANTIC.ok.tint, contrastText: '#fff' },
      warning: { main: SEMANTIC.warn.main, text: SEMANTIC.warn.text, subtle: SEMANTIC.warn.tint, contrastText: '#fff' },
      error: {
        main: dark ? s.danger : SEMANTIC.danger.main,
        text: dark ? s.danger : SEMANTIC.danger.text,
        subtle: dark ? '#2A1614' : SEMANTIC.danger.tint,
        contrastText: '#fff',
      },
      info: { main: SEMANTIC.info.main, text: SEMANTIC.info.text, subtle: SEMANTIC.info.tint, contrastText: '#fff' },
      divider: s.line,
      background: { default: s.page, paper: s.card },
      surface: { page: s.page, card: s.card, sunken: s.tint, borderStrong: s.lineStrong },
      text: { primary: s.ink, secondary: s.muted, disabled: s.mutedFill },
      action: {
        hover: s.tint,
        selected: s.tint,
        disabledBackground: s.tint,
        disabled: s.muted,
      },
    },

    shape: { borderRadius: RADIUS.card },
    spacing: 8,

    // Bound to the SAME ladder Tailwind builds its `z-*` utilities from, so a
    // portaled MUI menu and a Tailwind-styled sticky rail can never disagree about
    // which one is on top. `modal` covers Menu/Popover/Dialog — MUI routes all
    // three through Modal.
    zIndex: {
      fab: Z.fab,
      speedDial: Z.fab,
      appBar: Z.sticky,
      drawer: Z.drawer,
      modal: Z.overlay,
      snackbar: Z.toast,
      tooltip: Z.tooltip,
    },

    // Exposed so components can reach tokens without importing them.
    radius: RADIUS,
    motion: MOTION,
    layout: LAYOUT,
    z: Z,
    gradients: grad,
    elevationTokens: { 1: 'none', 2: 'none', 3: SHADOW.licenceSm, 4: SHADOW.dropdown },
    focusRing,

    typography: {
      fontFamily: FONT_STACK,
      fontSize: TYPE.base * scale,
      htmlFontSize: 16,
      h1: { fontWeight: 800, fontSize: fs(TYPE.display), lineHeight: 1.1, letterSpacing: '-0.02em' },
      h2: { fontWeight: 700, fontSize: fs(TYPE.banner), lineHeight: 1.15, letterSpacing: '-0.018em' },
      h3: { fontWeight: 700, fontSize: fs(TYPE.pageTitle), lineHeight: 1.2, letterSpacing: '-0.015em' },
      h4: { fontWeight: 700, fontSize: fs(TYPE.pageTitle), lineHeight: 1.2, letterSpacing: '-0.012em' },
      h5: { fontWeight: 700, fontSize: fs(TYPE.cardTitle), lineHeight: 1.3 },
      h6: { fontWeight: 700, fontSize: fs(TYPE.cardTitle), lineHeight: 1.35 },
      subtitle1: { fontWeight: 600, fontSize: fs(TYPE.lg), lineHeight: 1.5 },
      subtitle2: { fontWeight: 600, fontSize: fs(TYPE.base), lineHeight: 1.45 },
      body1: { fontSize: fs(TYPE.base), lineHeight: 1.6 },
      body2: { fontSize: fs(TYPE.sm), lineHeight: 1.5 },
      button: { fontWeight: 700, textTransform: 'none', letterSpacing: 0, fontSize: fs(TYPE.sm) },
      overline: { fontWeight: 700, letterSpacing: '0.1em', fontSize: fs(TYPE.micro), lineHeight: 1.5 },
      caption: { fontSize: fs(TYPE.sm), lineHeight: 1.45 },
    },

    components: {
      // Tailwind's preflight is the baseline now, so CssBaseline is NOT mounted
      // (see App.jsx). Only per-component visuals live here.
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', boxShadow: 'none' } } },
      // Glass, matching `.oc-card` in index.css exactly: translucent fill, green
      // hairline, and the two-layer elevation. No `backdrop-filter` — content cards
      // deliberately skip real blur so a page with 40 of them does not pay a per-card
      // compositor cost. See the taxonomy note in index.css for why only chrome
      // surfaces blur.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${g.hairline}`,
            borderRadius: RADIUS.card,
            backgroundColor: g.fill,
            boxShadow: gShadow.rest,
          },
        },
      },
      MuiCardActionArea: { styleOverrides: { root: { borderRadius: RADIUS.card, '&:focus-visible': focusRing } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: RADIUS.btn,
            minHeight: LAYOUT.tapTarget,
            paddingInline: 18,
            fontWeight: 700,
            '&:focus-visible': focusRing,
          },
          sizeSmall: { minHeight: 36, paddingInline: 14 },
          sizeLarge: { minHeight: 52, paddingInline: 24 },
          // Solid actions stay SOLID. A translucent primary button is the classic
          // glassmorphism mistake — the one control that must be unmistakable becomes
          // the one that dissolves into the background. Depth here is a colour-matched
          // lift only; the inset top-edge highlight was removed because it painted a
          // visible bright hairline along the top of every button.
          containedPrimary: {
            backgroundColor: BRAND.primary,
            color: '#fff',
            boxShadow: '0 2px 8px -1px rgba(11,110,79,0.35)',
            '&:hover': {
              backgroundColor: BRAND.primaryDark,
              boxShadow: '0 6px 16px -2px rgba(11,110,79,0.45)',
            },
          },
          containedSecondary: {
            backgroundColor: BRAND.gold,
            color: '#1F2A24',
            boxShadow: '0 2px 8px -1px rgba(180,150,10,0.40)',
            '&:hover': {
              backgroundColor: BRAND.goldHover,
              boxShadow: '0 6px 16px -2px rgba(180,150,10,0.50)',
            },
          },
          // The outlined button IS glass — it sits on cards and should belong to them.
          outlined: {
            borderColor: g.hairlineStrong,
            backgroundColor: g.fill,
            '&:hover': { borderColor: BRAND.primary, backgroundColor: s.tint },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: LAYOUT.tapTarget, minHeight: LAYOUT.tapTarget, '&:focus-visible': focusRing },
          sizeSmall: { minWidth: 36, minHeight: 36 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: RADIUS.pill, fontWeight: 700, fontSize: fs(TYPE.micro) },
          sizeSmall: { height: 26 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: RADIUS.btn, minHeight: LAYOUT.tapTarget, '&:focus-visible': focusRing },
        },
      },
      MuiTextField: { defaultProps: { size: 'medium' } },
      // Fields follow the same rest→focus model as `.oc-input`: a recessed
      // translucent well at rest, lifting to an OPAQUE surface on focus. The opacity
      // is an accessibility decision, not a style one — the value being typed must
      // never compete with the ambient mesh behind it.
      //
      // Focus is marked by the 2px border ALONE. A `0 0 0 3px` glow was tried and
      // removed: it read as a blurry smear around the field while typing, and on a
      // text input it stacked on top of the field's own focus border so the field
      // appeared to have two rings — precisely what the note in index.css @layer base
      // records the app having already fixed once.
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.btn,
            backgroundColor: g.fillSunken,
            transition: `background-color ${MOTION.fast}ms ${MOTION.ease}`,
            boxShadow: 'none',
            '& fieldset': { borderColor: g.hairline },
            '&:hover fieldset': { borderColor: g.hairlineStrong },
            '&.Mui-focused': { backgroundColor: s.card, boxShadow: 'none' },
            '&.Mui-focused fieldset': { borderColor: dark ? s.primary : BRAND.primary, borderWidth: 2 },
            '&.Mui-error fieldset': { borderColor: SEMANTIC.danger.main, borderWidth: 2 },
            '&.Mui-disabled': { backgroundColor: s.tint, boxShadow: 'none' },
          },
          input: { paddingBlock: 12, fontSize: fs(TYPE.base) },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: fs(TYPE.base) } } },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            fontSize: fs(TYPE.sm), marginLeft: 0, marginTop: 6,
            '&.Mui-error': { fontWeight: 600, color: SEMANTIC.danger.text },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: RADIUS.tile, fontSize: fs(TYPE.base), alignItems: 'flex-start' },
          standardSuccess: { backgroundColor: SEMANTIC.ok.tint, color: SEMANTIC.ok.text },
          standardWarning: { backgroundColor: SEMANTIC.warn.tint, color: SEMANTIC.warn.text },
          standardError: { backgroundColor: dark ? '#2A1614' : SEMANTIC.danger.tint, color: dark ? s.danger : SEMANTIC.danger.text },
          standardInfo: { backgroundColor: SEMANTIC.info.tint, color: SEMANTIC.info.text },
        },
      },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: RADIUS.btn, fontSize: fs(TYPE.micro), padding: '7px 10px', backgroundColor: BRAND.primaryDeepest } } },
      MuiSkeleton: { defaultProps: { animation: 'wave' }, styleOverrides: { root: { backgroundColor: s.tint, borderRadius: RADIUS.btn } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: RADIUS.pill, backgroundColor: s.tint, height: 8 } } },
      MuiDivider: { styleOverrides: { root: { borderColor: s.line } } },
      MuiLink: {
        defaultProps: { underline: 'hover' },
        styleOverrides: { root: { color: dark ? s.primary : BRAND.primary, fontWeight: 700, '&:focus-visible': { ...focusRing, borderRadius: 4 } } },
      },
      MuiCheckbox: { styleOverrides: { root: { color: s.lineStrong, '&.Mui-checked': { color: BRAND.primary }, '&:focus-visible': focusRing } } },
      MuiRadio: { styleOverrides: { root: { color: s.lineStrong, '&.Mui-checked': { color: BRAND.primary }, '&:focus-visible': focusRing } } },
      MuiMenuItem: { styleOverrides: { root: { minHeight: LAYOUT.tapTarget, fontSize: fs(TYPE.sm) } } },
      MuiStepLabel: { styleOverrides: { label: { fontSize: fs(TYPE.sm) } } },
      MuiAccordion: { styleOverrides: { root: { borderRadius: RADIUS.tile, border: `1px solid ${s.line}`, '&:before': { display: 'none' } } } },
      MuiAccordionSummary: { styleOverrides: { root: { minHeight: LAYOUT.tapTarget } } },
    },
  });
}

// ── Status vocabulary ────────────────────────────────────────────────────────
// Unchanged mapping — no status string changes meaning. Tones now resolve to the
// prototype's chip palette.
const STATUS = {
  submitted: 'info', in_progress: 'warning', in_review: 'warning', pending: 'default',
  awaiting_confirmation: 'warning', confirmed: 'success', booked: 'success',
  approved: 'success', issued: 'success', completed: 'success', rejected: 'error', suspended: 'error',
  paid: 'success', docs: 'error', review: 'warning',
};
export const statusColor = (v) => STATUS[v] || 'default';

// Plain-language labels. Raw values are machine tokens and were previously shown
// to citizens with only the underscores stripped. The prototype's own wording is
// adopted where it exists ("In Review", "Pending Documents").
const STATUS_LABEL = {
  submitted: 'Submitted',
  in_progress: 'In progress',
  in_review: 'In review',
  review: 'In review',
  pending: 'Pending',
  docs: 'Pending documents',
  awaiting_confirmation: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  booked: 'Booked',
  approved: 'Approved',
  issued: 'Ready to collect',
  completed: 'Completed',
  paid: 'Paid',
  rejected: 'Not approved',
  suspended: 'Suspended',
};
export const statusLabel = (v) => {
  if (!v) return '';
  return STATUS_LABEL[v] || String(v).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
};

/** Tailwind chip class for a status — used by the Tailwind component library. */
export const statusChipClass = (v) => {
  const tone = statusColor(v);
  return {
    success: 'oc-chip-ok',
    warning: 'oc-chip-warn',
    error: 'oc-chip-danger',
    info: 'oc-chip-ok',
    default: 'oc-chip-muted',
  }[tone];
};
