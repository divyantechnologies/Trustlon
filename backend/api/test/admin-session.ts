import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionService } from '../src/modules/auth/services/session.service';

/**
 * An admin panel access token for a user, as if they had passed two-factor sign-in.
 * The full sign-in flow (password + authenticator code) is covered in admin.e2e-spec.ts.
 */
export async function adminToken(app: INestApplication, email: string): Promise<string> {
  const user = await app.get(PrismaService).user.findUniqueOrThrow({ where: { email } });
  const session = await app.get(SessionService).create(user, {}, { mfa: true });
  return session.accessToken;
}
