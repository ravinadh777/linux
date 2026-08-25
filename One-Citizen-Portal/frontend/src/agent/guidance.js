// Context-aware guidance for AskGov — the brain behind the "real assistant" experience.
// Given WHERE the citizen is (route + live form progress), it produces a short guiding
// headline and the most relevant next-step suggestions. Pure + deterministic, so guidance
// is instant (no LLM round-trip); clicking a suggestion sends it to the agent, which then
// answers with live data. Keeping this in one place means every screen guides consistently.

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
const mentionsDocs = (t) => /document|upload|attach|file|proof|certificate/i.test(t || '');

/**
 * @param {object} ctx
 * @param {string} ctx.route            - current location.pathname
 * @param {object|null} ctx.progress    - assistantStore.formProgress (null when not on a form)
 * @returns {{ headline: string|null, chips: string[] }}
 */
export function buildGuide({ route = '/', progress = null } = {}) {
  // ── On an application form: guide section-by-section ─────────────────────────
  if (progress) {
    const { serviceName, activeIndex = 0, total = 1, currentTitle, isReview, documentsPending = [] } = progress;
    const step = Math.min(activeIndex + 1, total);
    const headline = isReview
      ? `Almost done with your ${serviceName} — review & submit`
      : `Guiding your ${serviceName} · Step ${step} of ${total}${currentTitle ? ` — ${currentTitle}` : ''}`;

    let chips;
    if (isReview) {
      chips = ['Is everything correct?', 'What happens after I submit?', 'How long until a decision?'];
    } else if (documentsPending.length && (mentionsDocs(currentTitle) || step >= total - 1)) {
      chips = [
        'Which documents do I need to upload?',
        'What file formats are accepted?',
        'Auto-fill the rest from my records',
      ];
    } else {
      chips = [
        'Auto-fill this section from my records',
        'What documents will I need?',
        'Explain this step',
        'How much is the fee?',
      ];
    }
    return { headline, chips: uniq(chips) };
  }

  // ── Off-form: route-based guidance ──────────────────────────────────────────
  if (route.startsWith('/dashboard')) {
    return {
      headline: 'How can I help you today?',
      chips: ["What's the status of my applications?", 'What can I apply for?', 'What are my next steps?'],
    };
  }
  if (route.startsWith('/tracking')) {
    return {
      headline: 'Tracking your applications',
      chips: ['Explain my application status', 'What happens next?', 'How long until a decision?'],
    };
  }
  if (route.startsWith('/services') || route.startsWith('/agencies')) {
    return {
      headline: 'Finding the right service',
      chips: ['Am I eligible for this?', 'What documents do I need?', 'How do I apply?', 'How much is the fee?'],
    };
  }
  if (route.startsWith('/profile')) {
    return { headline: 'Your profile', chips: ['Update my contact details', 'What is my information used for?'] };
  }
  return {
    headline: null,
    chips: ['Renew my passport', 'Apply for a pension', 'Track my application'],
  };
}

/** Merge the agent's own suggestions (if any) ahead of the contextual ones, de-duplicated. */
export function mergeSuggestions(agentSuggestions = [], contextChips = [], max = 5) {
  return uniq([...(agentSuggestions || []), ...contextChips]).slice(0, max);
}
