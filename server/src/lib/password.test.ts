import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from './password';

describe('password hashing', () => {
  it('hashes and compares a password correctly', async () => {
    const password = 'StrongPass123!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });

  it('produces different hashes for the same password (bcrypt salt)', async () => {
    const a = await hashPassword('SamePass123!');
    const b = await hashPassword('SamePass123!');
    expect(a).not.toBe(b);
    expect(await comparePassword('SamePass123!', a)).toBe(true);
    expect(await comparePassword('SamePass123!', b)).toBe(true);
  });
});
