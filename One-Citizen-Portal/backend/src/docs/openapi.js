// OpenAPI 3 description of the currently-implemented endpoints (Epic E0).
// Grows per module; the full human contract lives in docs/API.md. Served at /api/docs.
const errorResponse = {
  description: 'Error (standard contract)',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
              reasonCode: { type: 'string' },
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'oneCitizen Platform API',
    version: '0.1.0',
    description:
      'Government Digital Services Platform (Guyana). Bearer JWT via OneIdentity. ' +
      'This spec covers the platform foundation (Epic E0); module endpoints are added per story. ' +
      'Full contract: docs/API.md.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Identity' },
    { name: 'Delegation' },
    { name: 'Webhooks' },
    { name: 'Audit' },
    { name: 'Reference' },
    { name: 'System' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Identity'], summary: 'Password login (→ L2; officers require MFA)', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['identifier', 'password'], properties: { identifier: { type: 'string' }, password: { type: 'string' }, mfaCode: { type: 'string' } } } } } },
        responses: { 200: { description: 'Session' }, 400: errorResponse, 401: errorResponse, 403: errorResponse },
      },
    },
    '/auth/otp/request': { post: { tags: ['Identity'], summary: 'Request an OTP (account-less L1)', security: [], responses: { 200: { description: 'otpId + expiry' }, 400: errorResponse } } },
    '/auth/otp/verify': { post: { tags: ['Identity'], summary: 'Verify OTP → L1 session', security: [], responses: { 200: { description: 'Session' }, 401: errorResponse, 429: errorResponse } } },
    '/auth/refresh': { post: { tags: ['Identity'], summary: 'Rotate refresh token', security: [], responses: { 200: { description: 'Session' }, 401: errorResponse } } },
    '/auth/token': { post: { tags: ['Identity'], summary: 'OAuth2 client-credentials', security: [], responses: { 200: { description: 'Scoped token' }, 401: errorResponse, 403: errorResponse } } },
    '/auth/logout': { post: { tags: ['Identity'], summary: 'Revoke refresh + denylist access', responses: { 200: { description: 'Revoked' } } } },
    '/auth/step-up': { post: { tags: ['Identity'], summary: 'Step up assurance L1 → L2', responses: { 200: { description: 'L2 session' }, 400: errorResponse } } },
    '/auth/act-as': { post: { tags: ['Delegation'], summary: 'Issue a delegated (acting-for) session', responses: { 200: { description: 'Delegated session' }, 404: errorResponse } } },
    '/me': { get: { tags: ['Identity'], summary: 'Current principal profile + delegations', responses: { 200: { description: 'Profile' }, 401: errorResponse } } },
    '/delegations': {
      post: { tags: ['Delegation'], summary: 'Grant delegated authority (requires L2)', responses: { 201: { description: 'Created' }, 403: errorResponse } },
      get: { tags: ['Delegation'], summary: 'List delegations (granted + received)', responses: { 200: { description: 'Items' } } },
    },
    '/delegations/{id}': { delete: { tags: ['Delegation'], summary: 'Revoke a delegation (grantor only)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Revoked' }, 404: errorResponse } } },
    '/webhooks/subscriptions': {
      post: { tags: ['Webhooks'], summary: 'Subscribe to events (sysadmin)', responses: { 201: { description: 'Created' }, 400: errorResponse, 403: errorResponse } },
      get: { tags: ['Webhooks'], summary: 'List subscriptions (sysadmin)', responses: { 200: { description: 'Items' }, 403: errorResponse } },
    },
    '/webhooks/subscriptions/{id}': { delete: { tags: ['Webhooks'], summary: 'Remove a subscription', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Removed' }, 404: errorResponse } } },
    '/audit': { get: { tags: ['Audit'], summary: 'Query the audit trail (sysadmin/oversight)', parameters: [{ name: 'entity', in: 'query', schema: { type: 'string' } }, { name: 'entityId', in: 'query', schema: { type: 'string' } }, { name: 'actor', in: 'query', schema: { type: 'string' } }, { name: 'action', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Audit page' }, 403: errorResponse } } },
    '/reference/regions': { get: { tags: ['Reference'], summary: 'Regions 1–10', security: [], responses: { 200: { description: 'Regions' } } } },
    '/reference/local-authorities': { get: { tags: ['Reference'], summary: 'Local authorities', security: [], responses: { 200: { description: 'LAs' } } } },
    '/reference/fee-schedules': { get: { tags: ['Reference'], summary: 'Fee schedules', security: [], responses: { 200: { description: 'Fees' } } } },
    '/reference/document-types': { get: { tags: ['Reference'], summary: 'Document types', security: [], responses: { 200: { description: 'Doc types' } } } },
    '/reference/reason-codes': { get: { tags: ['Reference'], summary: 'Coded-reason vocabulary', security: [], parameters: [{ name: 'context', in: 'query', schema: { type: 'string', enum: ['refusal', 'rejection', 'suspension', 'no_trace'] } }], responses: { 200: { description: 'Reason codes' } } } },
  },
};
