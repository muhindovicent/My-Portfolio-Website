import { z } from 'zod.ts';

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: z.string().min(12, 'ADMIN_PASSWORD must be at least 12 characters'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  BASE_URL: z.string().default(''),
  CORS_ORIGIN: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

export function loadEnv(): Env {
  if (env) return env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(
      `[config/env] Missing or invalid environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and populate required values.'
    );
  }
  env = parsed.data;
  return env;
}

export function getEnv(): Env {
  if (!env) return loadEnv();
  return env;
}

export const requiredEnv = (key: keyof Env): string => {
  const e = getEnv();
  const value = e[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`[config/env] Required environment variable ${key} is not set`);
  }
  return String(value);
};

