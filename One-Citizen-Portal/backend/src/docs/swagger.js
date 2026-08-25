// Mounts Swagger UI at /api/docs and the raw spec at /api/docs.json (docs/API.md §16).
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './openapi.js';

export function mountSwagger(app) {
  app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'oneCitizen API' }));
}
