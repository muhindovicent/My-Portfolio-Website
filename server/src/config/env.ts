import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({ DATABASE_URL:z.string().url(), SESSION_SECRET:z.string().min(32),
  ENCRYPTION_KEY:z.string().regex(/^[0-9a-f]{64}$/i), PORT:z.coerce.number().int().min(0).max(65535).default(4000),
  ORIGIN_SECRET:z.string().min(32).optional(), NODE_ENV:z.enum(['production','development','test']).default('development'), CORS_ORIGIN:z.string().url().optional() });
export function loadEnv() {
  const config = schema.parse(process.env);
  if (config.NODE_ENV === 'production' && !config.ORIGIN_SECRET) throw Error('ORIGIN_SECRET is required behind the Vercel proxy');
  if (config.NODE_ENV === 'production' && (!config.CORS_ORIGIN || !config.CORS_ORIGIN.startsWith('https://') || new URL(config.CORS_ORIGIN).origin !== config.CORS_ORIGIN || config.CORS_ORIGIN.includes('*'))) throw Error('CORS_ORIGIN must be an exact HTTPS origin');
  return config;
}
export const getEnv = loadEnv;
