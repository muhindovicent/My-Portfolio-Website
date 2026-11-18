import { Request, RequestHandler } from 'express';
import { AppError } from '../middleware/error';
import { logSecurityEvent } from './securityEvent';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function generateCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getCsrfToken(req: Request): string | undefined {
  return (req.session as any)?.csrfToken;
}

export function setCsrfToken(req: Request, token: string): void {
  (req.session as any).csrfToken = token;
}

export function csrfProtection(req: Request, _res: any, next: any): void {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    next();
    return;
  }

  const sessionToken = getCsrfToken(req);
  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  const bodyToken = (req.body as any)?.csrfToken as string | undefined;

  const clientToken = headerToken ?? bodyToken;

  if (!sessionToken || !clientToken || clientToken !== sessionToken) {
    void logSecurityEvent({
      adminId: undefined,
      action: 'CSRF_VIOLATION',
      entity: 'Session',
      ipAddress: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.get('user-agent') ?? undefined,
      metadata: { method: req.method },
    }).catch(() => {});
    next(new AppError('CSRF token validation failed', 403));
    return;
  }

  next();
}

export const csrfMiddleware: RequestHandler = csrfProtection as RequestHandler;
