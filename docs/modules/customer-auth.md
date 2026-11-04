# Module: Customer Authentication

Build spec section 1 (1.1 `/signup`, 1.2 `/login`, 1.3 `/forgot-password`).

## Screens

| Route | Flow |
|---|---|
| `/signup` | Step 1 details (name, email, mobile with country code, password, optional referral, consent) → Step 2 email code → Step 3 mobile code → account created and signed in |
| `/login` | Password tab (default) or One-time code tab; each accepts an email, or a mobile number with country code |
| `/forgot-password` | Find account → verify code → new password |

All three use a split layout: brand panel with trust points on the left (desktop), form on the right.
Branch: `feature/storefront-customer-auth`.

## Files

| Layer | Path |
|---|---|
| Database models | `backend/api/prisma/schema/auth.prisma` |
| API module | `backend/api/src/modules/auth/` |
| Shared guards and decorators | `backend/api/src/common/auth/` |
| OTP delivery | `backend/api/src/modules/notifications/` |
| API tests | `backend/api/test/auth.e2e-spec.ts` |
| Storefront feature | `frontend/storefront/src/features/auth/` |
| Storefront routes | `frontend/storefront/src/app/(auth)/` |

## Database

| Table | Purpose |
|---|---|
| `users` | Every account on the platform: customers now, vendor and staff roles later. Email and mobile are both required, unique and verified at sign-up. Mobile numbers are stored in international E.164 format with the country. |
| `otp_challenges` | One row per code sent. Stores an HMAC of the code, attempt count, expiry and lock time. |
| `sessions` | One row per logged-in device. Stores a SHA-256 hash of the refresh token. |

## API

Base URL: `/api/v1/auth`

| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/otp/send` | `identifier`, `purpose` (`SIGNUP`, `LOGIN`, `RESET_PASSWORD`) | `expiresInSeconds`, `resendAfterSeconds` |
| POST | `/otp/verify` | `identifier`, `purpose`, `code`, `guestCartToken?` | `LOGIN`: session. Others: `verificationToken` |
| POST | `/signup/validate` | Same as `/signup` without the two tokens | `{ valid: true }`, or 409 with `field` (`email` or `mobile`) |
| POST | `/signup` | `fullName`, `email`, `mobile` (E.164), `password`, `country?`, `referralCode?`, `preferredLanguage?`, `marketingOptIn?`, `acceptTerms`, `emailVerificationToken`, `mobileVerificationToken` | Session |
| POST | `/login` | `identifier`, `password`, `guestCartToken?` | Session |
| POST | `/refresh` | Refresh cookie | Session with a rotated cookie |
| POST | `/logout` | Refresh cookie | 204 |
| POST | `/password/forgot` | `identifier` | Same as `/otp/send` |
| POST | `/password/reset` | `verificationToken`, `newPassword` | Message |
| GET | `/me` | `Authorization: Bearer <accessToken>` | `user` |

A session response is `{ accessToken, expiresInSeconds, user }`, plus an httpOnly `tl_rt` cookie scoped to `/api/v1/auth`.

## Rules implemented

| Rule | Where |
|---|---|
| Email, mobile, full name and password are required | `SignupDetailsDto`, `signupSchema` |
| Email and mobile must both be unique and verified by code before the account is created | `AuthService.validateSignup`, `sendOtp`, `signup` |
| Mobile numbers from any country, validated with libphonenumber and stored in E.164 | `common/utils/identifier.ts`, `lib/phone.ts` |
| Password: 8 to 72 characters with an uppercase letter, a lowercase letter and a number | `PASSWORD_PATTERN`, `PasswordRequirements` |
| Explicit consent: Terms required, marketing emails opt-in (unchecked by default) | `SignupForm`, `users.marketing_opt_in` |
| OTP valid for 5 minutes, maximum 5 attempts, then 15-minute lock | `OtpService` (values from `.env`) |
| 30-second resend timer | `OtpService.issue`, `OtpInput` |
| Same error for wrong password and unknown account | `AuthService.login` |
| Login and reset codes are not sent to unknown accounts, with the same response | `AuthService.sendOtp` |
| Access token 15 minutes; refresh token 30 days in an httpOnly cookie | `SessionService`, `RefreshCookie` |
| Refresh token rotates on every use; reuse of an old token revokes the session | `SessionService.rotate` |
| Password reset revokes all sessions; a reset link works only once | `AuthService.resetPassword` |
| Referral code stored on the new user; credit happens after the first delivered order | `AuthService.signup` emits `auth.user-registered` |
| Guest cart merged after login | `auth.user-logged-in` event carries `guestCartToken` for the cart module |
| Passwords hashed with bcrypt (12 rounds) | `AuthService` |
| Rate limits: 5 per minute on send endpoints, 10 per minute on verify and login | `AuthController` |

## Events for other modules

| Event | Payload | Listener to build |
|---|---|---|
| `auth.user-registered` | `userId`, `referredById` | Referral and affiliate module |
| `auth.user-logged-in` | `userId`, `guestCartToken?` | Cart module (merge guest cart) |

Listen with `@OnEvent(AUTH_EVENTS.USER_LOGGED_IN)` from `backend/api/src/modules/auth/auth.constants.ts`.

## Protecting routes in other modules

```ts
import { UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuthUser } from '../../common/auth/auth-user';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Get('vendors')
list(@CurrentUser() user: AuthUser) { /* ... */ }
```

On the storefront, call protected endpoints with `apiFetch(path, { auth: true })`. It adds the access token and renews it once on a 401.

## Still to connect

| Item | Needed before |
|---|---|
| Sign in with Google and Apple | Launch (optional) |
| SMS provider (MSG91 or Twilio) implementing `OtpSender` | Staging |
| Email provider (AWS SES) for email OTP | Staging |
| `/pages/terms` and `/pages/privacy` content | Launch |
