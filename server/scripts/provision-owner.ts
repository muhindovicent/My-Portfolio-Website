/**
 * Secure one-time owner provisioning script.
 *
 * This is NOT an HTTP endpoint. It is run once via CLI to provision the
 * single authorized administrator. Credentials come from environment
 * variables only — never hardcoded, never exposed via API.
 *
 * Usage:
 *   cp .env.example .env   # populate DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, etc.
 *   npm run prisma:generate
 *   npm run prisma:migrate
 *   npm run admin:provision
 *
 * The script is idempotent: if an administrator already exists, it exits
 * without making changes (single-administrator enforcement).
 */

import { db } from '../src/config/db.js';
import { hashPassword } from '../src/lib/password.js';
import { logSecurityEvent } from '../src/lib/securityEvent.js';

async function main() {
  console.log('[provision] Checking for existing administrator...');

  const count = await db.administrator.count();
  if (count > 0) {
    console.log('[provision] Administrator already exists. Aborting (single-administrator enforcement).');
    process.exit(0);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME;

  if (!adminEmail || !adminPassword) {
    throw new Error('[provision] ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  if (adminPassword.length < 12) {
    throw new Error('[provision] ADMIN_PASSWORD must be at least 12 characters');
  }

  console.log('[provision] Creating administrator...');

  const passwordHash = await hashPassword(adminPassword);

  const admin = await db.administrator.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: adminName ?? null,
      role: 'ADMIN',
      isActive: true,
      mfaEnabled: false,
      mfaEnforced: false,
      failedLoginCount: 0,
      provisionedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      provisionedAt: true,
    },
  });

  await logSecurityEvent({
    adminId: admin.id,
    action: 'PROVISION_OWNER',
    entity: 'Administrator',
    entityId: admin.id,
    ipAddress: '127.0.0.1',
    userAgent: 'provision-script',
    metadata: { email: adminEmail },
  });

  console.log('[provision] Administrator provisioned successfully:');
  console.log(`  id:    ${admin.id}`);
  console.log(`  email: ${admin.email}`);
  console.log(`  role:  ${admin.role}`);
  console.log('');
  console.log('[provision] Next steps:');
  console.log('  1. Log in at /admin/login');
  console.log('  2. Set up MFA at /admin/mfa/setup');
  console.log('  3. Store backup codes securely');

  await db.$disconnect();
}

main().catch((err) => {
  console.error('[provision] Fatal error:', err.message);
  process.exit(1);
});
