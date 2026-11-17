import * as speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateMfaSecret(): string {
  return speakeasy.generateSecret({ length: 32 }).base32;
}

export function generateMfaOtpUrl(secret: string, email: string, issuer: string = 'Muhindo Vicent Portfolio'): string {
  return speakeasy.otpauthURL({
    secret,
    label: email,
    issuer,
  });
}

export async function generateMfaQrCode(secret: string, email: string): Promise<string> {
  const otpUrl = generateMfaOtpUrl(secret, email);
  return QRCode.toDataURL(otpUrl);
}

export function verifyMfaToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // allow one step before/after for clock drift
  });
}

export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').substring(0, 8);
    codes.push(code);
  }
  return codes;
}
