import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OtpPurpose } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ConsoleOtpSender } from '../src/modules/notifications/otp-sender';
import { PrismaService } from '../src/prisma/prisma.service';

const MOBILE = '+91 98765 43210';
const MOBILE_E164 = '+919876543210';
const EMAIL = 'anil@example.com';
const PASSWORD = 'Trustlon123';

const details = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Anil Kushwah',
  email: 'Anil@Example.com',
  mobile: MOBILE,
  password: PASSWORD,
  acceptTerms: true,
  ...overrides,
});

describe('Customer authentication (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let otpSender: ConsoleOtpSender;

  const http = () => request(app.getHttpServer());

  const refreshCookieFrom = (res: request.Response): string | undefined => {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    return header?.find((c) => c.startsWith('tl_rt=') && !c.startsWith('tl_rt=;'))?.split(';')[0];
  };

  const requestCode = async (identifier: string, purpose: OtpPurpose, target = MOBILE_E164) => {
    await http().post('/api/v1/auth/otp/send').send({ identifier, purpose }).expect(200);
    const code = otpSender.lastCodeFor(target, purpose);
    expect(code).toMatch(/^\d{6}$/);
    return code as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    otpSender = app.get(ConsoleOtpSender);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE sessions, otp_challenges, users CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  let accessToken: string;
  let refreshCookie: string;

  const verifyFor = async (identifier: string, target: string) => {
    const code = await requestCode(identifier, OtpPurpose.SIGNUP, target);
    const res = await http()
      .post('/api/v1/auth/otp/verify')
      .send({ identifier, purpose: OtpPurpose.SIGNUP, code })
      .expect(200);
    return res.body.verificationToken as string;
  };

  it('validates sign-up details before sending codes', async () => {
    await http().post('/api/v1/auth/signup/validate').send(details()).expect(200);
    await http()
      .post('/api/v1/auth/signup/validate')
      .send(details({ password: 'alllowercase1' }))
      .expect(400);
    await http()
      .post('/api/v1/auth/signup/validate')
      .send(details({ mobile: '12345' }))
      .expect(400);
    await http()
      .post('/api/v1/auth/signup/validate')
      .send(details({ email: undefined }))
      .expect(400);
  });

  it('signs up a customer after verifying both email and mobile', async () => {
    const emailVerificationToken = await verifyFor(EMAIL, EMAIL);
    const mobileVerificationToken = await verifyFor(MOBILE, MOBILE_E164);

    const signup = await http()
      .post('/api/v1/auth/signup')
      .send({ ...details({ marketingOptIn: true }), emailVerificationToken, mobileVerificationToken })
      .expect(201);

    expect(signup.body.user).toMatchObject({
      mobile: MOBILE_E164,
      email: EMAIL,
      country: 'IN',
      mobileVerified: true,
      emailVerified: true,
      hasPassword: true,
    });
    expect(signup.body.user.referralCode).toMatch(/^TL[A-Z0-9]{8}$/);
    accessToken = signup.body.accessToken;
    refreshCookie = refreshCookieFrom(signup) as string;
    expect(refreshCookie).toBeDefined();
  });

  it('rejects sign-up when a verification token belongs to another address', async () => {
    const emailVerificationToken = await verifyFor('other@example.com', 'other@example.com');
    const mobileVerificationToken = await verifyFor('+12133734253', '+12133734253');
    await http()
      .post('/api/v1/auth/signup')
      .send({
        ...details({ email: 'third@example.com', mobile: '+12133734253' }),
        emailVerificationToken,
        mobileVerificationToken,
      })
      .expect(401);
  });

  it('rejects sign-up without accepting terms', async () => {
    await http()
      .post('/api/v1/auth/signup/validate')
      .send(details({ email: 'new@example.com', mobile: '+447911123456', acceptTerms: false }))
      .expect(400);
  });

  it('reports which field is already registered', async () => {
    const byEmail = await http()
      .post('/api/v1/auth/signup/validate')
      .send(details({ mobile: '+447911123456' }))
      .expect(409);
    expect(byEmail.body.field).toBe('email');

    const byMobile = await http()
      .post('/api/v1/auth/otp/send')
      .send({ identifier: MOBILE, purpose: OtpPurpose.SIGNUP })
      .expect(409);
    expect(byMobile.body.field).toBe('mobile');
  });

  it('returns the profile for a valid access token', async () => {
    const res = await http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.user.fullName).toBe('Anil Kushwah');
    await http().get('/api/v1/auth/me').expect(401);
  });

  it('logs in with password and gives the same error for wrong password and unknown user', async () => {
    const ok = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: 'anil@example.com', password: PASSWORD })
      .expect(200);
    expect(ok.body.accessToken).toBeDefined();

    const wrong = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: MOBILE, password: 'Wrong12345A' })
      .expect(401);
    const unknown = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: '+919000000000', password: 'Wrong12345A' })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('logs in with OTP', async () => {
    const code = await requestCode(MOBILE, OtpPurpose.LOGIN);
    const res = await http()
      .post('/api/v1/auth/otp/verify')
      .send({ identifier: MOBILE, purpose: OtpPurpose.LOGIN, code })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(refreshCookieFrom(res)).toBeDefined();
  });

  it('does not reveal unknown accounts when sending a login OTP', async () => {
    const res = await http()
      .post('/api/v1/auth/otp/send')
      .send({ identifier: '+919111111111', purpose: OtpPurpose.LOGIN })
      .expect(200);
    expect(otpSender.lastCodeFor('+919111111111', OtpPurpose.LOGIN)).toBeUndefined();
    expect(res.body.message).toMatch(/If an account exists/);
  });

  it('locks OTP verification after 5 wrong attempts', async () => {
    const code = await requestCode(MOBILE, OtpPurpose.LOGIN);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await http()
        .post('/api/v1/auth/otp/verify')
        .send({ identifier: MOBILE, purpose: OtpPurpose.LOGIN, code: wrong })
        .expect(400);
      expect(res.body.attemptsLeft).toBe(5 - attempt);
    }
    await http()
      .post('/api/v1/auth/otp/verify')
      .send({ identifier: MOBILE, purpose: OtpPurpose.LOGIN, code: wrong })
      .expect(429);
    await http()
      .post('/api/v1/auth/otp/verify')
      .send({ identifier: MOBILE, purpose: OtpPurpose.LOGIN, code })
      .expect(429);
    await http()
      .post('/api/v1/auth/otp/send')
      .send({ identifier: MOBILE, purpose: OtpPurpose.LOGIN })
      .expect(429);
  });

  it('rotates the refresh token and revokes the session when an old token is reused', async () => {
    const first = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);
    const rotated = refreshCookieFrom(first) as string;
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(refreshCookie);

    await prisma.session.updateMany({ data: { rotatedAt: new Date(Date.now() - 60_000) } });
    await http().post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(401);
    await http().post('/api/v1/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('resets the password, revokes sessions and rejects reuse of the reset token', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: MOBILE, password: PASSWORD })
      .expect(200);
    const sessionCookie = refreshCookieFrom(login) as string;

    await http()
      .post('/api/v1/auth/password/forgot')
      .send({ identifier: 'anil@example.com' })
      .expect(200);
    const code = otpSender.lastCodeFor('anil@example.com', OtpPurpose.RESET_PASSWORD) as string;

    const verify = await http()
      .post('/api/v1/auth/otp/verify')
      .send({ identifier: 'anil@example.com', purpose: OtpPurpose.RESET_PASSWORD, code })
      .expect(200);

    await http()
      .post('/api/v1/auth/password/reset')
      .send({ verificationToken: verify.body.verificationToken, newPassword: 'NewPass2026' })
      .expect(200);

    await http().post('/api/v1/auth/refresh').set('Cookie', sessionCookie).expect(401);
    await http()
      .post('/api/v1/auth/login')
      .send({ identifier: MOBILE, password: 'NewPass2026' })
      .expect(200);
    await http()
      .post('/api/v1/auth/password/reset')
      .send({ verificationToken: verify.body.verificationToken, newPassword: 'Another2026' })
      .expect(401);
  });

  it('logs out and invalidates the refresh token', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: MOBILE, password: 'NewPass2026' })
      .expect(200);
    const cookie = refreshCookieFrom(login) as string;

    await http().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    await http().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('stores the referrer when a valid referral code is used', async () => {
    const referrer = await prisma.user.findUniqueOrThrow({ where: { mobile: MOBILE_E164 } });
    const email = 'referred@example.com';
    const mobile = '+971501234567';
    const emailVerificationToken = await verifyFor(email, email);
    const mobileVerificationToken = await verifyFor(mobile, mobile);

    await http()
      .post('/api/v1/auth/signup')
      .send({
        ...details({ fullName: 'Referred Customer', email, mobile }),
        referralCode: referrer.referralCode.toLowerCase(),
        emailVerificationToken,
        mobileVerificationToken,
      })
      .expect(201);

    const referred = await prisma.user.findUniqueOrThrow({ where: { mobile } });
    expect(referred.referredById).toBe(referrer.id);
    expect(referred.country).toBe('AE');
  });
});
