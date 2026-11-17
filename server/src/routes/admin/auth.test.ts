import { describe, it, expect } from 'vitest';
import { hashPassword } from '../../lib/password';
import { AppError } from '../../middleware/error';
import fs from 'fs';
import path from 'path';

describe('Auth security properties', () => {
  it('hashes passwords with bcrypt (strong hashing)', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(20);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('produces different hashes for same password (salt)', async () => {
    const a = await hashPassword('SamePass123!');
    const b = await hashPassword('SamePass123!');
    expect(a).not.toBe(b);
  });

  it('AppError exposes status code and message', () => {
    const err = new AppError('Invalid credentials', 401);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid credentials');
    expect(err.isOperational).toBe(true);
  });
});

describe('No hardcoded credentials in source', () => {
  const authFile = fs.readFileSync(
    path.join(__dirname, 'auth.ts'),
    'utf8'
  );

  it('does not contain hardcoded plaintext passwords', () => {
    expect(authFile).not.toMatch(/password:\s*["'][^"']{3,}["']/);
    expect(authFile).not.toMatch(/passwordHash:\s*["'][^"']{3,}["']/);
  });

  it('does not expose secrets in source code', () => {
    expect(authFile).not.toMatch(/JWT_SECRET\s*=\s*["'][^"']{10,}["']/);
    expect(authFile).not.toMatch(/SESSION_SECRET\s*=\s*["'][^"']{10,}["']/);
    expect(authFile).not.toMatch(/COOKIE_SECRET\s*=\s*["'][^"']{10,}["']/);
    expect(authFile).not.toMatch(/DATABASE_URL\s*=\s*["'][^"']{10,}["']/);
  });
});
