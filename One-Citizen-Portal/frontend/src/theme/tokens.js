// ─────────────────────────────────────────────────────────────────────────────
// oneCitizen design tokens — THE single source, extracted from the approved
// prototype (One_Citizen_Portal_Dashboard.html).
//
// Consumed by BOTH styling systems so they can never diverge:
//   • tailwind.config.js  imports this and builds the utility scale from it
//   • theme/theme.js      imports this for the MUI bridge (the five behavioural
//                         primitives we keep, and any screen not yet migrated)
//
// Deliberately dependency-free and plain-JS so Tailwind's config can import it
// at build time.
//
// Two values are NOT verbatim from the prototype, because measured contrast put
// them below WCAG AA for body text:
//   • muted      #5F7168 → #55655C → #4D5D54  (see below)
//   • danger text #C1443A → #AE372E  on red tint: 4.34:1 → 5.33:1
// The originals are retained for non-text use (fills, dots, borders), where the
// 3:1 UI-component threshold applies and they pass comfortably.
//
// `muted` was corrected a SECOND time when the glass surfaces landed. The page is
// no longer a flat #F3F8F5 — it carries the ambient mesh (see `mesh()` below) that
// the frosted surfaces refract, so any text sitting directly on the page (page
// subtitles, breadcrumbs, empty-state copy outside a card) is now composited over
// the mesh's DARKEST point rather than over a known flat colour. Measured against
// that worst case:
//        #55655C  4.47:1  ✗ (below the 4.5 AA floor)
//        #4D5D54  4.74:1  ✓  — and 6.30:1 once it is on a glass card
// Chosen with ~0.2 of headroom so a future mesh tweak cannot silently drop it back
// under. The mesh alphas were themselves capped by this same measurement: a
// stronger mesh looked better but pushed `primary`, `danger.text` and `gold.text`
// under AA on bare backdrops, which would have meant restyling half the palette.
//
// Audience note driving the type scale: this portal processes old-age pension
// claims. The prototype's body text is 13px with 45 declarations at ≤11px; the
// operational floor here is 14px and body is 15–16px. Hierarchy and proportion
// are unchanged — the whole ladder moved one step together.
// ─────────────────────────────────────────────────────────────────────────────

// ── Brand ────────────────────────────────────────────────────────────────────
export const BRAND = {
  primary: '#0B6E4F',        // Guyana green — 6.25:1 on white
  primaryDark: '#095940',    // hover / pressed
  primaryDeep: '#07402F',    // banners, sidebar promo
  primaryDeepest: '#052A1F', // toast
  gold: '#FCD116',           // payment action — ink on gold is 10.09:1
  goldHover: '#EAC412',
  goldText: '#8A6B00',       // gold as text on white: 5.02:1
};

// ── Ink + surfaces (light) ───────────────────────────────────────────────────
export const LIGHT = {
  ink: '#1F2A24',            // 14.84:1 on white
  muted: '#4D5D54',          // corrected twice — 4.74:1 on the mesh, 6.30:1 on glass
  mutedFill: '#5F7168',      // original — icons/dividers only, never text
  page: '#F3F8F5',
  card: '#FFFFFF',
  tint: '#E4F1EA',
  tint2: '#D8EDE3',
  line: '#DCEAE3',
  lineStrong: '#C3D9CD',
};

// ── Ink + surfaces (dark) — the prototype ships no dark theme; designed here so
//    the accent still reads: green 8.78:1, gold 11.44:1 on the dark card. ─────
export const DARK = {
  ink: '#E6EFE9',
  muted: '#93A89C',
  mutedFill: '#93A89C',
  page: '#0B1411',
  card: '#12201A',
  tint: '#16291F',
  tint2: '#1B3125',
  line: '#22362C',
  lineStrong: '#334A3D',
  primary: '#5FCFA4',
  danger: '#F0938A',
};

// ── Semantic ─────────────────────────────────────────────────────────────────
export const SEMANTIC = {
  danger: { main: '#C1443A', text: '#AE372E', tint: '#FBEAE8' },
  warn: { main: '#B26A00', text: '#6B4E00', tint: '#FCEFB8' },
  ok: { main: '#0B6E4F', text: '#095940', tint: '#E4F1EA' },
  info: { main: '#0B6E4F', text: '#095940', tint: '#E4F1EA' },
};

// ── Radius — the prototype's five distinct values ────────────────────────────
export const RADIUS = { btn: 8, pay: 9, tile: 10, card: 12, banner: 14, pill: 999 };

// ── Layout ───────────────────────────────────────────────────────────────────
export const LAYOUT = {
  sidebar: 232,
  panel: 372,
  topbar: 64,
  shellMax: 1440,
  tapTarget: 44,      // WCAG 2.5.5
  inputHeight: 48,
  cardPadX: 20,
  cardPadY: 18,
  gridGap: 18,
  tileGap: 12,
};

// ── Motion ───────────────────────────────────────────────────────────────────
export const MOTION = { fast: 120, base: 180, slow: 240, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' };

// ── Stacking order ───────────────────────────────────────────────────────────
// ONE ladder for the whole app. Before this, the values were ad-hoc — the topbar on
// Tailwind's bare step 40, the toast at 2000, the skip link at 3000 — with
// (NB: written without the literal utility name; Tailwind's content scanner reads
//  comments too, and spelling it out here was enough to emit a dead class.)
// MUI running its own implicit ladder underneath (drawer 1200 / modal 1300 /
// snackbar 1400 / tooltip 1500). Nothing enforced an order between the two sets,
// and one pairing was actually inverted: the toast at 2000 painted OVER an open
// menu at 1300.
//
// The MUI keys keep their default numbers on purpose. Every MUI popper, menu and
// dialog positions itself against `theme.zIndex`, so renumbering them buys nothing
// and risks a mismatch with any internal default we don't override. Instead the
// app's own layers are slotted into the gaps MUI leaves, and theme.js feeds this
// object straight back into `theme.zIndex` so both systems read one source.
//
// Order, low → high. The numbers at 1050+ ARE MUI's own defaults, kept verbatim so
// nothing we don't override can disagree with them:
//   base      0     page content
//   sticky    100   topbar + sticky rails — above content, below every overlay
//   fab       1050  floating assistant launcher (MUI `fab`)
//   drawer    1200  MUI Drawer — mobile nav, mobile assistant
//   overlay   1300  MUI `modal`. Menu, Popover, Autocomplete popper AND Dialog all
//                   route through Modal, so they necessarily share one level —
//                   within it, the last-opened wins, which is the correct behaviour.
//   toast     1400  transient confirmations (MUI `snackbar`). ABOVE overlay so a
//                   toast is never hidden behind an open dropdown — this is the
//                   pairing that was inverted before, at 2000 vs 1300.
//   tooltip   1500  MUI `tooltip`
//   skipLink  2000  first tab stop; must clear everything, toast included
export const Z = {
  base: 0,
  sticky: 100,
  fab: 1050,
  drawer: 1200,
  overlay: 1300,
  toast: 1400,
  tooltip: 1500,
  skipLink: 2000,
};

// ── Shadow ───────────────────────────────────────────────────────────────────
// Every shadow is tinted with the brand green rather than black. A neutral black
// shadow over a green-tinted page reads as grey dirt; `rgba(7,64,47,…)` reads as
// depth in the same colour family as the surface it falls on.
//
// The glass surfaces use TWO layers on purpose: a tight 1–2px contact shadow that
// defines the edge, plus a wide diffuse shadow with a NEGATIVE spread so it stays
// under the card instead of haloing out sideways. One-layer shadows are the main
// reason "glassy" UI so often looks like a drop-shadowed rectangle.
export const SHADOW = {
  dropdown: '0 12px 28px rgba(7,64,47,0.16)',
  licence: '0 8px 20px rgba(7,64,47,0.12)',
  licenceSm: '0 3px 10px rgba(7,64,47,0.14)',
  toast: '0 10px 24px rgba(0,0,0,0.25)',
  shell: '0 0 40px rgba(0,0,0,0.06)',
  // Glass elevation ladder.
  glass: '0 1px 2px rgba(7,64,47,0.04), 0 8px 24px -8px rgba(7,64,47,0.10)',
  glassHover: '0 1px 2px rgba(7,64,47,0.05), 0 16px 36px -12px rgba(7,64,47,0.16)',
  glassRaised: '0 2px 4px rgba(7,64,47,0.06), 0 24px 48px -16px rgba(7,64,47,0.20)',
  glassDark: '0 1px 2px rgba(0,0,0,0.30), 0 8px 24px -8px rgba(0,0,0,0.45)',
  glassHoverDark: '0 1px 2px rgba(0,0,0,0.35), 0 16px 36px -12px rgba(0,0,0,0.55)',
  glassRaisedDark: '0 2px 4px rgba(0,0,0,0.40), 0 24px 48px -16px rgba(0,0,0,0.65)',
};

// ── Glass ────────────────────────────────────────────────────────────────────
// The frosted-surface vocabulary. Two things have to be true at once for glass to
// read as glass rather than as "a slightly see-through box":
//
//   1. TRANSLUCENT FILL over a NON-FLAT backdrop. A blur over a flat colour is
//      indistinguishable from that colour, so the page carries an ambient mesh
//      (see `mesh` below) for the surfaces to refract.
//   2. LAYERED, TINTED SHADOW (see SHADOW.glass* above).
//
// A third ingredient — a `highlight` inset (`inset 0 1px 0 rgba(255,255,255,.65)`)
// simulating light catching the pane's upper lip — was tried and REMOVED. In theory
// it is what stops a translucent panel looking flat; in practice, at this palette
// and these fill opacities it painted a visible bright hairline along the top edge
// of every card, button and icon chip, and picked up a colour cast from whatever it
// sat on (reading as a yellow line on the amber chips and a green one on the brand
// ones). The layered shadow alone carries the depth without that artefact.
//
// ── The two constraints this object deliberately encodes ──────────────────────
//
// PERFORMANCE. `backdrop-filter` forces the compositor to snapshot and blur the
// backdrop for every element that carries it. At ~40 cards per page that is a
// measurable frame cost on the low-end Android hardware most citizens use. So
// real blur is reserved for the ~8 CHROME surfaces that genuinely overlap
// scrolling content (top bar, sidebar, assistant rail, dialog, menu, popover,
// toast, sticky rails) — `blurChrome`. Content cards use fill + shadow and NO blur
// (`fill`, no `backdrop-filter`), which reads as the same material at zero GPU cost.
//
// ACCESSIBILITY. The alphas are floors, not preferences. `fill` at 0.72 is the
// LOWEST opacity at which the composited surface still clears WCAG AA for body
// text against the darkest point of the mesh — measured, not eyeballed. Anything
// carrying text uses `fill` or `fillStrong`; `fillSubtle` is for decorative
// wells and non-text chrome only. index.css also ships an opaque fallback for
// browsers without `backdrop-filter` and honours `prefers-reduced-transparency`.
export const GLASS = {
  light: {
    // Surfaces that carry text.
    fill: 'rgba(255,255,255,0.72)',
    fillStrong: 'rgba(255,255,255,0.86)',
    // Recessed wells (inputs at rest, table stripes, review rows).
    fillSunken: 'rgba(228,241,234,0.55)',
    // Decorative / non-text only — below the AA floor for body copy.
    fillSubtle: 'rgba(255,255,255,0.45)',
    // Borders: a bright inner lip plus a green hairline for definition on light.
    stroke: 'rgba(255,255,255,0.70)',
    hairline: 'rgba(11,110,79,0.12)',
    hairlineStrong: 'rgba(11,110,79,0.22)',
  },
  dark: {
    fill: 'rgba(18,32,26,0.72)',
    fillStrong: 'rgba(18,32,26,0.88)',
    fillSunken: 'rgba(22,41,31,0.60)',
    fillSubtle: 'rgba(230,239,233,0.06)',
    stroke: 'rgba(230,239,233,0.10)',
    hairline: 'rgba(230,239,233,0.12)',
    hairlineStrong: 'rgba(230,239,233,0.20)',
  },
  // px. `chrome` is the only value applied via backdrop-filter at scale.
  blur: { sm: 8, chrome: 16, lg: 24 },
  // Saturation lift applied with the blur. Blurring alone desaturates whatever is
  // behind the glass and makes the brand green go muddy; 140% puts the colour back.
  saturate: 1.4,
};

// Ambient page backdrop — the thing the glass refracts.
//
// The alphas here are NOT a taste setting; they are the output of a contrast
// solve. Every value was raised until the darkest composited point of the mesh
// put `muted` text at ~4.7:1 (AA + headroom) and left `primary`, `danger.text`
// and `warn.text` passing on all three glass backdrops. See the note on `muted`
// in LIGHT above for the measurements.
//
// The FOURTH layer is the trick that buys visual depth for free: a white bloom in
// the top-left. Darkening the mesh to add presence costs contrast on every dark
// text colour; a light bloom adds just as much perceived depth and *raises*
// contrast for dark text, so it is pure upside. It is listed first so it paints
// on top of the green washes.
export const mesh = (mode) => {
  const dark = mode === 'dark';
  const base = dark ? DARK.page : LIGHT.page;
  return dark
    ? `radial-gradient(900px circle at 18% -6%, rgba(230,239,233,0.045), transparent 60%),`
      + `radial-gradient(1200px circle at 12% -8%, rgba(95,207,164,0.10), transparent 55%),`
      + `radial-gradient(900px circle at 88% 4%, rgba(11,110,79,0.20), transparent 55%),`
      + `radial-gradient(1000px circle at 72% 96%, rgba(252,209,22,0.05), transparent 55%),`
      + `linear-gradient(${base}, ${base})`
    : `radial-gradient(900px circle at 18% -6%, rgba(255,255,255,0.10), transparent 60%),`
      + `radial-gradient(1200px circle at 12% -8%, rgba(11,110,79,0.13), transparent 55%),`
      + `radial-gradient(900px circle at 88% 4%, rgba(11,110,79,0.09), transparent 55%),`
      + `radial-gradient(1000px circle at 72% 96%, rgba(252,209,22,0.10), transparent 55%),`
      + `linear-gradient(${base}, ${base})`;
};

// ── Type ─────────────────────────────────────────────────────────────────────
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const MONO_STACK = '"Cascadia Code", Consolas, ui-monospace, monospace';

// px. `card*` stay pixel-faithful to the prototype: they render facsimiles of
// physical ID/licence cards, where small print is authentic and is looked at
// rather than read to operate the portal.
export const TYPE = {
  cardXs: 7,
  cardSm: 8,
  cardMd: 10,
  cardLg: 13,
  micro: 12,       // chips, table headers, timestamps
  label: 13,       // field labels
  sm: 14,          // operational floor
  base: 15,        // body
  lg: 16,          // emphasis body
  cardTitle: 17,
  pageTitle: 22,
  banner: 25,
  display: 30,
};

// ── Gradients — derived from tokens, never written as literals, so dark mode
//    cannot end up with light-mode text on a light-mode gradient. ─────────────
export const gradients = (mode) => {
  const dark = mode === 'dark';
  return {
    banner: `linear-gradient(120deg, ${BRAND.primaryDeep} 0%, ${BRAND.primary} 100%)`,
    // `brand` is the pre-rename name and is kept as an alias. Two screens read
    // `theme.gradients.brand` and, once the key disappeared, resolved it to
    // `undefined` — which with their `color:'#fff'` rendered white text on a white
    // card. Aliasing is cheaper than hoping every call site gets found.
    brand: `linear-gradient(120deg, ${BRAND.primaryDeep} 0%, ${BRAND.primary} 100%)`,
    hero: `linear-gradient(120deg, ${BRAND.primaryDeepest} 0%, ${BRAND.primary} 60%, #0F8A63 100%)`,
    idCard: dark
      ? `linear-gradient(135deg, ${DARK.tint} 0%, ${DARK.tint2} 100%)`
      : `linear-gradient(135deg, ${LIGHT.tint} 0%, ${LIGHT.tint2} 100%)`,
    // The national flag band used across the licence facsimiles.
    flag: 'linear-gradient(100deg, #CE1126 0%, #CE1126 33%, #1A1A1A 33%, #1A1A1A 38%, #FCD116 38%, #FCD116 54%, #009739 54%, #009739 100%)',
    licence: 'linear-gradient(115deg, #FBEFEC 0%, #FBEFEC 46%, #E9F3EC 56%, #E9F3EC 100%)',
  };
};

export const surfaceFor = (mode) => (mode === 'dark' ? DARK : LIGHT);
export const glassFor = (mode) => (mode === 'dark' ? GLASS.dark : GLASS.light);
/** The elevation ladder for the active mode — keeps shadow choice off call sites. */
export const glassShadowFor = (mode) => (mode === 'dark'
  ? { rest: SHADOW.glassDark, hover: SHADOW.glassHoverDark, raised: SHADOW.glassRaisedDark }
  : { rest: SHADOW.glass, hover: SHADOW.glassHover, raised: SHADOW.glassRaised });
