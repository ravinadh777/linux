// AskGov assistant (FR-P10). The reasoning lives in a swappable engine (assistantEngine.js);
// this service only fetches the citizen profile from the file store, audits the turn, and
// delegates. It NEVER submits — the citizen confirms every action in the primary UI.
// To go live with a real model, pass a different `engine` in — see assistantEngine.js.
import { SYSTEM_CTX } from '../../config/repositories.js';
import { createRuleEngine } from './assistantEngine.js';

export function createAssistantService({ repos, engine = createRuleEngine() }) {
  // Flatten the user + its profile block into one object the engine can read by key.
  async function profileOf(auth) {
    if (!auth?.sub) return null;
    try {
      const user = await repos.users.findById(auth.sub, SYSTEM_CTX);
      if (!user) return null;
      return {
        name: user.name,
        fullName: user.name,
        email: user.email,
        ...(user.profile || {}),
      };
    } catch {
      return null;
    }
  }

  return {
    async message({ auth, message = '', context = {}, requestId }) {
      const profile = await profileOf(auth);

      await repos.audit.append({
        actor: auth?.sub || null,
        actingFor: auth?.actingFor || null,
        action: 'assistant.message',
        entity: 'assistant',
        entityId: context?.page || null,
        requestId: requestId || null,
      });

      // Single delegation point — swap the engine for real AI without touching anything else.
      const turn = engine.respond({ text: String(message), profile, context });
      return {
        reply: turn.reply,
        actions: Array.isArray(turn.actions) ? turn.actions : [],
        suggestions: Array.isArray(turn.suggestions) ? turn.suggestions : [],
      };
    },
  };
}
