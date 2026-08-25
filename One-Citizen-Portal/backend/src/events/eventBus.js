// In-process typed pub/sub with an outbox (Architecture §6.5).
// emit() persists the event (participating in the current tx, so it rolls back atomically)
// and defers DISPATCH to after commit — guaranteeing e.g. `death.registered` never fires
// before the state that produced it is durably persisted.
export function createEventBus({ registry, repos, dispatcher, logger }) {
  const handlers = new Map(); // type -> [handler]

  async function dispatch(record) {
    // 1) in-process subscribers
    const subs = handlers.get(record.type) || [];
    for (const h of subs) {
      try {
        await h(record);
      } catch (err) {
        logger?.error?.({ err, type: record.type }, 'event_handler_error');
      }
    }
    // 2) external webhooks
    try {
      if (dispatcher) await dispatcher.deliver(record);
    } catch (err) {
      logger?.error?.({ err, type: record.type }, 'webhook_dispatch_error');
    }
  }

  return {
    /** Register an in-process handler for an event type. */
    subscribe(type, handler) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(handler);
    },

    /**
     * Emit an event. Persists to the append-only outbox now (inside the caller's tx if any),
     * and dispatches AFTER the tx commits (or immediately when not in a tx).
     * @param {Object} e - { type, payload, requestId?, actor? }
     */
    async emit({ type, payload = {}, requestId, actor }) {
      const record = await repos.events.append({ type, payload, requestId, actor, dispatched: false });
      // In a tx: deferred to post-commit. Outside a tx: runs now (await the returned promise).
      await registry.afterCommit(() => dispatch(record));
      return record;
    },

    // exposed for tests
    _dispatch: dispatch,
  };
}
