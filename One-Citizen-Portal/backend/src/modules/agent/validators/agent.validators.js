// Request validation (Phase 9 — validation layer, SOLID boundary).
// Zod schemas validate every inbound request at the controller edge. No business logic.
import { z } from 'zod';
import { ValidationError } from '../../../lib/errors.js';
import { AgentTrigger } from '../constants/events.js';

const FormFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  type: z.string().optional(),
  options: z.array(z.any()).optional(),
  required: z.boolean().optional(),
}).passthrough();

const PageSchema = z.object({
  currentPage: z.string().optional(),
  route: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  formFields: z.array(FormFieldSchema).max(200).optional(),
  formValues: z.record(z.any()).optional(),
}).partial().passthrough();

const TriggerSchema = z.nativeEnum(AgentTrigger).default(AgentTrigger.USER_MESSAGE);

export const CreateSessionSchema = z.object({
  page: PageSchema.optional(),
  title: z.string().max(200).optional(),
});

export const ChatSchema = z.object({
  threadId: z.string().min(1).max(200).optional(),
  message: z.string().max(8000).optional().default(''),
  page: PageSchema.optional(),
  trigger: TriggerSchema,
}).refine(
  (v) => (v.message && v.message.trim().length > 0) || v.trigger !== AgentTrigger.USER_MESSAGE,
  { message: 'message is required for a user_message trigger', path: ['message'] },
);

export const FormSyncSchema = z.object({
  threadId: z.string().min(1).max(200),
  formValues: z.record(z.any()),
  page: PageSchema.optional(),
});

export const ExtractSchema = z.object({
  threadId: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(8000),
  page: PageSchema.optional(),
});

export const ResetSchema = z.object({
  threadId: z.string().min(1).max(200),
});

/** Parse `data` with `schema`, throwing the app ValidationError on failure. */
export function validate(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new ValidationError('Invalid agent request', details);
  }
  return result.data;
}
