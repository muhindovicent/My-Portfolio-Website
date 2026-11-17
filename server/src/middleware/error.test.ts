import { describe, it, expect } from 'vitest';
import { AppError, errorHandler } from './error';

describe('AppError', () => {
  it('carries statusCode and message', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });
});

describe('errorHandler', () => {
  const makeRes = () => {
    let captured: { code: number; body: any } | null = null;
    const res: any = {
      status: (code: number) => {
        captured = { code, body: undefined };
        return {
          json: (body: any) => {
            captured = { code, body };
          },
        };
      },
      get captured() {
        return captured;
      },
    };
    return res;
  };

  it('responds with AppError status and message', () => {
    const err = new AppError('Custom error', 422);
    const res = makeRes();
    errorHandler(err, {} as any, res, () => {});
    expect(res.captured!.code).toBe(422);
    expect(res.captured!.body.error.message).toBe('Custom error');
    expect(res.captured!.body.error.statusCode).toBe(422);
  });

  it('handles Prisma P2025 as 404', () => {
    const err: any = { code: 'P2025' };
    const res = makeRes();
    errorHandler(err, {} as any, res, () => {});
    expect(res.captured!.code).toBe(404);
    expect(res.captured!.body.error.code).toBe('RecordNotFound');
  });

  it('handles Prisma P2002 as 409', () => {
    const err: any = { code: 'P2002' };
    const res = makeRes();
    errorHandler(err, {} as any, res, () => {});
    expect(res.captured!.code).toBe(409);
    expect(res.captured!.body.error.code).toBe('UniqueConstraintViolation');
  });
});
