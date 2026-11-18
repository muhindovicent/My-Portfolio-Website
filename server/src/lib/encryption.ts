import crypto from 'crypto.ts';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes)');
  }
  try {
    return Buffer.from(hex, 'hex');
  } catch {
    throw new Error('ENCRYPTION_KEY must be valid hexadecimal');
  }
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns: iv:authTag:ciphertext (all hex, colon-separated)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypt a string produced by encrypt().
 */
export function decrypt(token: string): string {
  const key = getEncryptionKey();
  const parts = token.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

