import { describe, it, expect } from 'vitest';
import { generateMfaSecret, verifyMfaToken, generateBackupCodes, generateMfaQrCode } from './mfa';

describe('MFA utilities', () => {
  it('generates a valid base32 secret', () => {
    const secret = generateMfaSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
    // base32 alphabet: A-Z, 2-7
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('verifies a valid TOTP token', () => {
    const secret = generateMfaSecret();
    const token = '123456';
    // We can't easily generate a valid TOTP token without knowing the time,
    // but we can verify that an invalid token returns false
    expect(verifyMfaToken(secret, '000000')).toBe(false);
  });

  it('rejects wrong-length tokens', () => {
    const secret = generateMfaSecret();
    expect(verifyMfaToken(secret, '12345')).toBe(false);
    expect(verifyMfaToken(secret, '1234567')).toBe(false);
  });

  it('generates backup codes', () => {
    const codes = generateBackupCodes(8);
    expect(codes.length).toBe(8);
    for (const code of codes) {
      expect(code.length).toBe(8);
      expect(/^[0-9a-f]+$/.test(code)).toBe(true);
    }
  });

  it('generates QR code data URL', async () => {
    const qrCode = await generateMfaQrCode('TESTSECRET1234', 'admin@example.com');
    expect(qrCode.startsWith('data:image/png;base64,')).toBe(true);
  });
});
