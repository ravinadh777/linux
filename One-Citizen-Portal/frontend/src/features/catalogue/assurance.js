// ─────────────────────────────────────────────────────────────────────────────
// Identity-assurance levels, translated for citizens.
//
// The catalogue pages used to render the raw value as a chip reading
// "Assurance L2" / "Requires assurance L2", which is meaningless to a citizen —
// and worse, it is noise: backend/src/platform/identity/identity.service.js
// assigns assuranceLevel 2 to "a registered user who authenticated with a
// password", i.e. anyone who is signed in already satisfies level 2.
//
// So a level of 2 or below tells the citizen nothing actionable and is hidden.
// Only a level ABOVE the signed-in baseline is worth surfacing, because that is
// the case where they will actually be asked to do something extra (step-up —
// see POST /auth/step-up).
// ─────────────────────────────────────────────────────────────────────────────

/** The level any signed-in, password-authenticated citizen already holds. */
export const BASELINE_ASSURANCE = 2;

/**
 * @returns {string|null} A plain-language note, or null when the requirement is
 *   already met by simply being signed in (the common case).
 */
export function assuranceNote(level) {
  const n = Number(level) || 0;
  if (n <= BASELINE_ASSURANCE) return null;
  return 'Extra identity verification needed — you will be asked to confirm who you are before submitting.';
}
