// HTTP controllers (Phase 2 — thin controller layer; Phase 3 — SSE streaming).
// Controllers validate input via DTOs, delegate to the service, and shape responses.
// The chat controller manages the SSE lifecycle (headers, heartbeat, client-abort).
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { logger } from '../../../lib/logger.js';
import {
  validate, CreateSessionSchema, ChatSchema, FormSyncSchema, ExtractSchema, ResetSchema,
} from '../validators/agent.validators.js';
import { toSessionDto, toMessageDto } from '../dto/agent.dto.js';

const log = logger.child ? logger.child({ mod: 'agent.controller' }) : logger;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
};

export function createAgentController({ agentService }) {
  // POST /agent/chat — open an AG-UI SSE run (Phase 3).
  async function chat(req, res) {
    // Validate BEFORE switching to SSE so input errors return a normal JSON response
    // (this handler owns its response and is not covered by the error middleware).
    let dto;
    try {
      dto = validate(ChatSchema, req.body);
    } catch (err) {
      return res.status(err.httpStatus || 400).json({
        error: { code: err.code || 'VALIDATION_ERROR', message: err.message, details: err.details },
      });
    }
    res.writeHead(200, SSE_HEADERS);
    res.flushHeaders?.();
    res.write(': open\n\n'); // prime the stream

    const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 15000);
    const ac = new AbortController();
    req.on('close', () => ac.abort());

    try {
      for await (const frame of agentService.streamRun({
        auth: req.auth, dto, token: bearer(req), signal: ac.signal,
      })) {
        res.write(frame);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        log.warn({ err: err.message }, 'chat stream error');
        try {
          res.write(`data: ${JSON.stringify({ type: 'RUN_ERROR', message: 'Stream ended unexpectedly.', code: 'STREAM_ERROR', timestamp: Date.now() })}\n\n`);
        } catch { /* socket already gone */ }
      }
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
    return undefined;
  }

  return {
    chat, // NB: not wrapped in asyncHandler — it owns the SSE response lifecycle.

    // POST /agent/session — start (or restore context for) a conversation.
    createSession: asyncHandler(async (req, res) => {
      const dto = validate(CreateSessionSchema, req.body);
      const thread = await agentService.createSession({ auth: req.auth, page: dto.page, title: dto.title });
      res.status(201).json(toSessionDto(thread));
    }),

    // GET /agent/sessions — list the citizen's conversations.
    listSessions: asyncHandler(async (req, res) => {
      const items = await agentService.listSessions({ auth: req.auth });
      res.json({ items: items.map(toSessionDto) });
    }),

    // GET /agent/history?threadId=… — full transcript + persisted form state.
    history: asyncHandler(async (req, res) => {
      const threadId = String(req.query.threadId || '');
      if (!threadId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'threadId is required' } });
      const { messages, formState } = await agentService.getHistory({ auth: req.auth, threadId });
      return res.json({ threadId, messages: messages.map(toMessageDto), formState });
    }),

    // POST /agent/reset — clear a conversation (keeps the thread id).
    reset: asyncHandler(async (req, res) => {
      const dto = validate(ResetSchema, req.body);
      const thread = await agentService.reset({ auth: req.auth, threadId: dto.threadId });
      res.json(toSessionDto(thread));
    }),

    // POST /agent/form-sync — persist live form values (user-edit → agent context).
    formSync: asyncHandler(async (req, res) => {
      const dto = validate(FormSyncSchema, req.body);
      const out = await agentService.syncForm({ auth: req.auth, threadId: dto.threadId, formValues: dto.formValues, page: dto.page });
      res.json(out);
    }),

    // POST /agent/extract — one-shot entity extraction (field/value/confidence/source/…).
    extract: asyncHandler(async (req, res) => {
      const dto = validate(ExtractSchema, req.body);
      const out = await agentService.extract({ auth: req.auth, threadId: dto.threadId, message: dto.message, page: dto.page, token: bearer(req) });
      res.json(out);
    }),

    // GET /agent/status — upstream engine health + mode.
    status: asyncHandler(async (_req, res) => {
      res.json(await agentService.status());
    }),
  };
}
