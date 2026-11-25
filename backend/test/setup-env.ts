process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgresql://trustlon:trustlon@localhost:5432/trustlon_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-characters';
process.env.OTP_SECRET ??= 'test-otp-secret-that-is-at-least-32-characters-long';
process.env.OTP_RESEND_SECONDS = '0';
