import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken, verifyToken } from './auth';

describe('JWT tokens', () => {
  const payload = { sub: 'admin-1', email: 'admin@test.example.com', role: 'ADMIN' };

  it('signs and verifies an access token', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.type).toBe('access');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.type).toBe('refresh');
  });

  it('rejects a malformed token', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });

  it('rejects a token with wrong secret', () => {
    const token = signAccessToken(payload);
    // Tamper with the signature portion so verification fails
    const parts = token.split('.');
    parts[2] = 'tampered-signature';
    expect(() => verifyToken(parts.join('.'))).toThrow();
  });
});
