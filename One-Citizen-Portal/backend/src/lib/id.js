import { randomUUID } from 'node:crypto';

/**
 * Generate a prefixed id, e.g. newId('doc') → 'doc_9f1c…'.
 * Records are ordered by (createdAt, id); the UUID breaks createdAt ties deterministically.
 */
export function newId(prefix = 'id') {
  return `${prefix}_${randomUUID()}`;
}
