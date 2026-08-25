// Tests for the middleware chain (story S0.2): requestId, error contract, async propagation.
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { requestId } from './requestId.js';
import { notFound, errorHandler } from './error.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { BusinessRuleError } from '../lib/errors.js';

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(express.json());

  app.get('/ok', (req, res) => res.json({ requestId: req.id, ok: true }));

  app.get('/app-error', () => {
    throw new BusinessRuleError('Insurance lapsed', 'REJ-INCOMPLETE', [{ field: 'insurance', issue: 'expired' }]);
  });

  app.get('/generic', () => {
    throw new Error('secret internal detail that must not leak');
  });

  app.get(
    '/async-reject',
    asyncHandler(async () => {
      throw new BusinessRuleError('Async rule', 'REJ-DUPLICATE');
    }),
  );

  app.get(
    '/zod',
    asyncHandler(async (req) => {
      z.object({ tin: z.string().min(5) }).parse(req.query); // will throw ZodError
    }),
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('requestId', () => {
  it('mints a request id and echoes it in header + body', async () => {
    const res = await request(buildApp()).get('/ok');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(/^req_/);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('reuses an inbound X-Request-Id', async () => {
    const res = await request(buildApp()).get('/ok').set('X-Request-Id', 'req_provided_123');
    expect(res.headers['x-request-id']).toBe('req_provided_123');
    expect(res.body.requestId).toBe('req_provided_123');
  });
});

describe('error contract', () => {
  it('maps an AppError to status/code/message/reasonCode/details + requestId', async () => {
    const res = await request(buildApp()).get('/app-error');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
      message: 'Insurance lapsed',
      reasonCode: 'REJ-INCOMPLETE',
      details: [{ field: 'insurance', issue: 'expired' }],
    });
    expect(res.body.error.requestId).toMatch(/^req_/);
    expect(res.body.error.timestamp).toBeTruthy();
  });

  it('hides internal details for non-AppError (no leak)', async () => {
    const res = await request(buildApp()).get('/generic');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error.message).toBe('Internal error');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });

  it('propagates async rejections to the handler', async () => {
    const res = await request(buildApp()).get('/async-reject');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(res.body.error.reasonCode).toBe('REJ-DUPLICATE');
  });

  it('maps a ZodError to VALIDATION_ERROR 400 with field details', async () => {
    const res = await request(buildApp()).get('/zod');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0]).toHaveProperty('field', 'tin');
  });

  it('returns the contract shape for unmatched routes (404)', async () => {
    const res = await request(buildApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toMatch(/^req_/);
  });
});
