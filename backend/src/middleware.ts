import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express route handler so a rejected promise is forwarded to
 * the error-handling middleware instead of crashing the process.
 *
 * Express 4 does not catch rejections from async handlers — an unhandled
 * rejection (e.g. a failing DB query) takes down the whole Node process rather
 * than returning a 500. Every async handler should be wrapped with this.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/**
 * Top-level error-handling middleware. Must be registered last, after all
 * routes. The 4-argument signature is what marks it as an error handler to
 * Express, so `next` must stay in the parameter list.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[error]', message, err instanceof Error ? err.stack : '');

  // If headers were already sent, delegate to Express's default handler, which
  // closes the connection cleanly.
  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
