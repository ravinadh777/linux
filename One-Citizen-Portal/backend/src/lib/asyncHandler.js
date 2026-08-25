// Wrap async route handlers so rejected promises reach the central error middleware.
// Usage: router.get('/x', asyncHandler(async (req, res) => { ... }))
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
