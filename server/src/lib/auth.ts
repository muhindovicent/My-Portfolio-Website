import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { getEnv } from '../config/env';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
};

export type { JwtPayload };

export function signAccessToken(payload: Omit<JwtPayload, 'type'> & { type?: 'access' }): string {
  const env = getEnv();
  return jwt.sign(
    { ...payload, type: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL } as SignOptions
  );
}

export function signRefreshToken(payload: Omit<JwtPayload, 'type'> & { type?: 'refresh' }): string {
  const env = getEnv();
  return jwt.sign(
    { ...payload, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL } as SignOptions
  );
}

export function verifyToken(token: string): JwtPayload {
  const env = getEnv();
  return jwt.verify(token, env.JWT_SECRET, {} as VerifyOptions) as JwtPayload;
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;
