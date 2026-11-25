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
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

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
    /**
     * Encrypts secrets kept in the database (authenticator secrets, payment gateway keys, bank
     * account numbers). Use 32+ random characters and never change it once data exists.
     * Optional in development, required in production.
     */
    DATA_ENCRYPTION_KEY: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined))
      .refine((value) => value === undefined || value.length >= 32, 'Use at least 32 characters'),
    /** Where staff open the admin panel; used in links from the API. */
    ADMIN_URL: z.string().default('http://localhost:3001'),
    /** Folder for uploaded files such as return photos. Relative paths start at the API folder. */
    STORAGE_DIR: z.string().min(1).default('storage'),
    /**
     * India Post pincode lookup used when a pincode isn't in our pincode master yet.
     * Leave empty to turn it off (it is always off in tests).
     */
    PINCODE_LOOKUP_URL: z.string().default('https://api.postalpincode.in/pincode'),
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
    if (env.NODE_ENV === 'production' && !env.DATA_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATA_ENCRYPTION_KEY'],
        message: 'DATA_ENCRYPTION_KEY is required in production',
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
