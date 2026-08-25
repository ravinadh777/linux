import { describe, it, expect } from 'vitest';
import { buildTheme } from './theme.js';
import { Z } from './tokens.js';

// Locks the stacking order across BOTH styling systems. The bug this guards against
// is not hypothetical: the toast shipped at a bare 2000 while MUI put dropdowns at
// 1300, so a toast painted over an open menu. Because Tailwind reads Z at build time
// and MUI reads it at runtime, a drift between them is invisible until something
// overlaps in production — hence an assertion rather than a comment.
describe('z-index ladder', () => {
  const z = buildTheme('light').zIndex;

  it('binds MUI zIndex to the shared Z scale', () => {
    expect(z.appBar).toBe(Z.sticky);
    expect(z.drawer).toBe(Z.drawer);
    expect(z.modal).toBe(Z.overlay);
    expect(z.snackbar).toBe(Z.toast);
    expect(z.tooltip).toBe(Z.tooltip);
  });

  it('orders the layers low → high with no ties', () => {
    const ladder = [Z.base, Z.sticky, Z.fab, Z.drawer, Z.overlay, Z.toast, Z.tooltip, Z.skipLink];
    expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    expect(new Set(ladder).size).toBe(ladder.length);
  });

  it('keeps sticky chrome BELOW every overlay', () => {
    // The topbar and the sticky rails must slide under menus, drawers and dialogs.
    expect(Z.sticky).toBeLessThan(Z.drawer);
    expect(Z.sticky).toBeLessThan(Z.overlay);
  });

  it('keeps toasts ABOVE dropdowns', () => {
    // The specific inversion that existed before: toast 2000 vs dropdown 1300.
    expect(Z.toast).toBeGreaterThan(Z.overlay);
  });

  it('keeps the skip link above everything — it is the first tab stop', () => {
    expect(Z.skipLink).toBeGreaterThan(Math.max(Z.toast, Z.tooltip, Z.overlay));
  });
});
