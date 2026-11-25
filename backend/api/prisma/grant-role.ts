/**
 * Makes the first Super Admin (after that, add staff from Admin › Staff).
 *
 *   npm run admin:grant -w backend/api -- you@company.com SUPER_ADMIN
 *
 * The account must already exist (sign up on the storefront first). On the first admin panel
 * sign-in they set up an authenticator app (two-factor authentication is required).
 * Roles: SUPER_ADMIN, MARKETING, FINANCE, SUPPORT, LOGISTICS, CA; CUSTOMER removes access.
 */
import { PrismaClient, UserRole } from '@prisma/client';

async function main() {
  const [email, roleArg = 'SUPER_ADMIN'] = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('--'));
  if (!email) throw new Error('Pass the email address of an existing account.');
  const role = roleArg.toUpperCase() as UserRole;
  if (!Object.values(UserRole).includes(role)) {
    throw new Error(`Unknown role ${roleArg}. Use one of: ${Object.values(UserRole).join(', ')}`);
  }
  const prisma = new PrismaClient();
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { role },
    select: { email: true, role: true },
  });
  console.log(
    `${user.email} is now ${user.role}. Open the admin panel (http://localhost:3001) and sign in.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
