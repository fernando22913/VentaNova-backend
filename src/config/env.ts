import { existsSync } from 'node:fs';
import { z } from 'zod';

import { parseDurationToSeconds } from './duration.js';

const nodeEnv = process.env.NODE_ENV ?? 'development';

if (nodeEnv === 'development' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    // Seed-only: credentials for the initial ADMIN account. Optional here so
    // the API can boot without them; the seed enforces their presence and
    // reads them from Render secrets in production (never hardcoded).
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    // Token lifetimes (compact durations: s/m/h/d). Access tokens are
    // short-lived JWTs; refresh tokens are opaque and rotated on every use.
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('1h'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
    // Structured-log verbosity. Test runs force `silent` regardless of this.
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((value, ctx) => {
    // Never boot a production deployment with the example/placeholder secret:
    // anyone could then forge tokens. Fails fast instead of running insecure.
    if (value.NODE_ENV === 'production' && /change[_-]?me|example|placeholder/i.test(value.JWT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must not be a placeholder value in production',
      });
    }

    // Reject malformed durations at boot rather than at the first login.
    for (const key of ['ACCESS_TOKEN_EXPIRES_IN', 'REFRESH_TOKEN_EXPIRES_IN'] as const) {
      try {
        parseDurationToSeconds(value[key]);
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Must be a duration like "1h" or "7d"',
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment variables:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
