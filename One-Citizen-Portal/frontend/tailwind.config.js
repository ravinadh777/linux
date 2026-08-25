/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
// Tailwind is the styling system for oneCitizen. Its scale is built FROM
// src/theme/tokens.js — the same module the MUI bridge imports — so the two can
// never drift apart. Edit tokens.js, not this file.
//
// MUI is retained only for five behavioural primitives (Dialog focus trap,
// Drawer, Popover/Menu positioning, Autocomplete combobox a11y, Stepper); their
// visuals are neutralised in src/index.css so they inherit these tokens.
//
// This config previously resolved `primary` to `rgb(var(--color-primary))` — CSS
// variables that no longer existed — and not one component used a Tailwind class,
// so the whole file was dead.
// ─────────────────────────────────────────────────────────────────────────────
import {
  BRAND, LIGHT, DARK, SEMANTIC, RADIUS, LAYOUT, MOTION, SHADOW, TYPE, Z, GLASS,
  FONT_STACK, MONO_STACK,
} from './src/theme/tokens.js';

const px = (n) => `${n}px`;
/** Tailwind wants [size, {lineHeight}] tuples. */
const t = (size, lh) => [px(size), { lineHeight: String(lh) }];

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    // Breakpoint ladder. Tailwind's defaults stop at 2xl (1536px), which leaves
    // 1920 and 2560 monitors on the same layout as a 1600 laptop — the point where
    // a full-bleed shell starts to hurt. `3xl` and `4xl` are where grids gain
    // columns and gutters widen rather than cards simply stretching.
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
      '4xl': '2400px',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: BRAND.primary,
          dark: BRAND.primaryDark,
          deep: BRAND.primaryDeep,
          deepest: BRAND.primaryDeepest,
        },
        gold: {
          DEFAULT: BRAND.gold,
          hover: BRAND.goldHover,
          text: BRAND.goldText,
        },
        ink: LIGHT.ink,
        muted: LIGHT.muted,
        'muted-fill': LIGHT.mutedFill,
        page: LIGHT.page,
        card: LIGHT.card,
        tint: LIGHT.tint,
        tint2: LIGHT.tint2,
        line: LIGHT.line,
        'line-strong': LIGHT.lineStrong,

        danger: { DEFAULT: SEMANTIC.danger.main, text: SEMANTIC.danger.text, tint: SEMANTIC.danger.tint },
        warn: { DEFAULT: SEMANTIC.warn.main, text: SEMANTIC.warn.text, tint: SEMANTIC.warn.tint },
        ok: { DEFAULT: SEMANTIC.ok.main, text: SEMANTIC.ok.text, tint: SEMANTIC.ok.tint },

        // Dark-mode counterparts, prefixed so a class reads explicitly.
        'd-page': DARK.page,
        'd-card': DARK.card,
        'd-tint': DARK.tint,
        'd-line': DARK.line,
        'd-ink': DARK.ink,
        'd-muted': DARK.muted,
        'd-primary': DARK.primary,
        'd-danger': DARK.danger,

        // ── Glass fills + strokes ────────────────────────────────────────────
        // Exposed as colours (not just component classes) so a one-off surface
        // can reach the same material without inventing its own rgba().
        glass: {
          DEFAULT: GLASS.light.fill,
          strong: GLASS.light.fillStrong,
          sunken: GLASS.light.fillSunken,
          subtle: GLASS.light.fillSubtle,
          stroke: GLASS.light.stroke,
          hairline: GLASS.light.hairline,
          'hairline-strong': GLASS.light.hairlineStrong,
        },
        'd-glass': {
          DEFAULT: GLASS.dark.fill,
          strong: GLASS.dark.fillStrong,
          sunken: GLASS.dark.fillSunken,
          subtle: GLASS.dark.fillSubtle,
          stroke: GLASS.dark.stroke,
          hairline: GLASS.dark.hairline,
          'hairline-strong': GLASS.dark.hairlineStrong,
        },
      },

      backdropBlur: {
        glass: `${GLASS.blur.sm}px`,
        chrome: `${GLASS.blur.chrome}px`,
        'glass-lg': `${GLASS.blur.lg}px`,
      },
      backdropSaturate: { glass: String(GLASS.saturate) },

      fontFamily: {
        sans: FONT_STACK.split(', '),
        mono: MONO_STACK.split(', '),
      },

      fontSize: {
        // Facsimile print — pixel-faithful to the prototype on purpose.
        'card-xs': t(TYPE.cardXs, 1.25),
        'card-sm': t(TYPE.cardSm, 1.25),
        'card-md': t(TYPE.cardMd, 1.3),
        'card-lg': t(TYPE.cardLg, 1.25),
        // Operational UI — the prototype's ladder lifted one step.
        micro: t(TYPE.micro, 1.4),
        label: t(TYPE.label, 1.45),
        sm: t(TYPE.sm, 1.5),
        base: t(TYPE.base, 1.6),
        lg: t(TYPE.lg, 1.6),
        'card-title': t(TYPE.cardTitle, 1.35),
        'page-title': t(TYPE.pageTitle, 1.2),
        banner: t(TYPE.banner, 1.15),
        display: t(TYPE.display, 1.1),
      },

      borderRadius: {
        btn: px(RADIUS.btn),
        pay: px(RADIUS.pay),
        tile: px(RADIUS.tile),
        card: px(RADIUS.card),
        banner: px(RADIUS.banner),
        pill: px(RADIUS.pill),
      },

      boxShadow: {
        dropdown: SHADOW.dropdown,
        licence: SHADOW.licence,
        'licence-sm': SHADOW.licenceSm,
        toast: SHADOW.toast,
        shell: SHADOW.shell,
        // Glass elevation ladder — two layers each (contact + diffuse), see tokens.js.
        glass: SHADOW.glass,
        'glass-hover': SHADOW.glassHover,
        'glass-raised': SHADOW.glassRaised,
        'glass-dark': SHADOW.glassDark,
        'glass-hover-dark': SHADOW.glassHoverDark,
        'glass-raised-dark': SHADOW.glassRaisedDark,
      },

      spacing: {
        sidebar: px(LAYOUT.sidebar),
        panel: px(LAYOUT.panel),
        topbar: px(LAYOUT.topbar),
        'card-x': px(LAYOUT.cardPadX),
        'card-y': px(LAYOUT.cardPadY),
        tap: px(LAYOUT.tapTarget),
        input: px(LAYOUT.inputHeight),
      },

      maxWidth: {
        shell: px(LAYOUT.shellMax),
        // Reading measures. The SHELL is full-bleed, but running text still gets a
        // cap — 15px type across a 2560px viewport is a ~230-character line, which
        // is unreadable however much space is available.
        prose: '68ch',
        'prose-wide': '84ch',
        // Ceiling for a single centred column (auth forms, confirmations).
        form: '640px',
      },

      gridTemplateColumns: {
        // The dashboard's asymmetric split — services wide, profile narrow. The
        // ratio opens up on very wide screens so the services grid takes the extra
        // room rather than the profile card growing into whitespace.
        'dash-2': '1.55fr 1fr',
        'dash-2-wide': '2fr 1fr',
        'dash-2-ultra': '2.4fr 1fr',
        shell: `${px(LAYOUT.sidebar)} minmax(0, 1fr)`,
      },

      transitionDuration: {
        fast: `${MOTION.fast}ms`,
        // `base` is a NAMED alias for the same value as DEFAULT, and it is load-bearing
        // for two reasons:
        //   1. `duration-base` was already being written in component className strings
        //      (StatStrip, and others). With only a DEFAULT key it did not exist, so
        //      Tailwind silently emitted nothing and those transitions ran at the
        //      browser default of 0s — a no-op that looked like working code.
        //   2. `@apply duration-DEFAULT` is a hard build ERROR (DEFAULT generates the
        //      bare `duration` utility, not `duration-DEFAULT`). That was latent in
        //      .oc-card-interactive, which nothing used until now, so it had never
        //      been compiled.
        // Keeping DEFAULT as well means the bare `duration` utility still works.
        base: `${MOTION.base}ms`,
        DEFAULT: `${MOTION.base}ms`,
        slow: `${MOTION.slow}ms`,
      },
      transitionTimingFunction: { standard: MOTION.ease },

      minHeight: { 'below-topbar': `calc(100dvh - ${px(LAYOUT.topbar)})`, tap: px(LAYOUT.tapTarget) },
      height: { 'below-topbar': `calc(100dvh - ${px(LAYOUT.topbar)})` },

      // One stacking ladder, shared with theme.zIndex — see Z in tokens.js.
      // Named rather than numeric so `z-sticky` states the intent and a stray
      // `z-40` can no longer land between two layers by accident.
      zIndex: {
        base: String(Z.base),
        sticky: String(Z.sticky),
        fab: String(Z.fab),
        drawer: String(Z.drawer),
        overlay: String(Z.overlay),
        toast: String(Z.toast),
        tooltip: String(Z.tooltip),
        'skip-link': String(Z.skipLink),
      },
    },
  },

  // Preflight ON — Tailwind owns the baseline now. MUI's CssBaseline is removed
  // in App.jsx so two competing resets cannot fight.
  plugins: [],
};
