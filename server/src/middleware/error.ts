export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
    stack?: string;
  };
}

export function errorHandler(
  err: unknown,
  _req: import('express').Request,
  res: import('express').Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: import('express').NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: err.constructor.name,
        message: err.message,
        statusCode: err.statusCode,
      },
    };
    if (!isProduction && err.stack) {
      response.error.stack = err.stack;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  // Prisma known error codes
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as Record<string, unknown>).code);
    if (code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'UniqueConstraintViolation',
          message: 'A record with this value already exists.',
          statusCode: 409,
        },
      });
      return;
    }
    if (code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'RecordNotFound',
          message: 'Requested record was not found.',
          statusCode: 404,
        },
      });
      return;
    }
    if (code === 'P2003') {
      res.status(400).json({
        error: {
          code: 'ForeignKeyConstraintViolation',
          message: 'Referenced record does not exist.',
          statusCode: 400,
        },
      });
      return;
    }
  }

  // Zod validation errors
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as Record<string, unknown>).issues)) {
    const issues = (err as Record<string, unknown>).issues as Array<{ path: (string | number)[]; message: string }>;
    res.status(400).json({
      error: {
        code: 'ValidationError',
        message: 'Request validation failed.',
        statusCode: 400,
        details: issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  const message = isProduction ? 'Internal server error' : err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({
    error: {
      code: 'InternalServerError',
      message,
      statusCode: 500,
      ...(!isProduction && err instanceof Error && { stack: err.stack }),
    },
  });
}

export function asyncHandler(
  fn: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<unknown>
) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: import('express').Request, res: import('express').Response): void {
  res.status(404).json({
    error: {
      code: 'NotFound',
      message: 'The requested resource does not exist.',
      statusCode: 404,
    },
  });
}
