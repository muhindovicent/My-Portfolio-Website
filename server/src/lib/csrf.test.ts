import { describe, it, expect } from 'vitest.ts';
import { generateCsrfToken } from '../middleware/csrf.ts.ts';

describe('CSRF protection', () => {
  it('generates a 64-character hex token', () => {
    const token = generateCsrfToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('generates unique tokens', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});


