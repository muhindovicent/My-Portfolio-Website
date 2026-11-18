import { describe, it, expect } from 'vitest.ts';
import { encrypt, decrypt, generateEncryptionKey } from './encryption.ts.ts';

describe('AES-GCM encryption', () => {
  const key = generateEncryptionKey();
  process.env.ENCRYPTION_KEY = key;

  it('encrypts and decrypts correctly', () => {
    const plaintext = 'base32totalsecret1234567890';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const a = encrypt('sameplaintext');
    const b = encrypt('sameplaintext');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('sameplaintext');
    expect(decrypt(b)).toBe('sameplaintext');
  });

  it('format is iv:authTag:ciphertext (hex colon-separated)', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(24); // 12 bytes IV = 24 hex chars
    expect(parts[1].length).toBe(32); // 16 bytes auth tag = 32 hex chars
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    parts[2] = '00000000000000000000000000000000'; // corrupt ciphertext
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('rejects invalid format', () => {
    expect(() => decrypt('invalid')).toThrow();
    expect(() => decrypt('a:b')).toThrow();
  });
});

describe('Encryption key generation', () => {
  it('generates 64 hex characters', () => {
    const key = generateEncryptionKey();
    expect(key.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });
});


