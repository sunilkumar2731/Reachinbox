import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Centralized error handler.
 * All errors thrown inside async route handlers (via express-async-errors)
 * bubble up here. We return a consistent JSON shape.
 */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env['NODE_ENV'] === 'production';

  console.error(`[Error] ${statusCode} — ${err.message}`, {
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message ?? 'Internal Server Error',
      // Only expose stack traces in development
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}

/**
 * Factory for creating typed operational errors.
 */
export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
