import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    DATABASE_URL: z.string().url(),

    JWT_ACCESS_SECRET: z.string().min(32),
    OTP_SECRET: z.string().min(32),

    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    VERIFICATION_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),

    OTP_PROVIDER: z.enum(['console']).default('console'),
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
    OTP_RESEND_SECONDS: z.coerce.number().int().nonnegative().default(30),

    COOKIE_SECURE: bool,
    /** Folder for uploaded files such as return photos. Relative paths start at the API folder. */
    STORAGE_DIR: z.string().min(1).default('storage'),
    COOKIE_DOMAIN: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.OTP_PROVIDER === 'console') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OTP_PROVIDER'],
        message: 'The console OTP provider must not be used in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
