// Response DTO mappers (Phase 9 — DTOs). Shape persisted records into stable client
// responses so internal fields (version, ownerId, deletedAt) never leak over the wire.

export function toSessionDto(thread) {
  return {
    threadId: thread.id,
    title: thread.title || null,
    serviceId: thread.serviceId || null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    formState: thread.formState || {},
  };
}

export function toMessageDto(m) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls || undefined,
    prefill: m.prefill || undefined,
    suggestions: m.suggestions || undefined,
    runId: m.runId || undefined,
    createdAt: m.createdAt,
  };
}
