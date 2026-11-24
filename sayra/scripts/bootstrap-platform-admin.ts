import readline from 'readline';
import argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';

// Resolve Prisma configuration dynamically: prefer src/config/prisma in development/testing (TS), and dist/config/prisma in production
let prisma: PrismaClient;
let connectPrisma: (() => Promise<void>) | undefined;
let disconnectPrisma: (() => Promise<void>) | undefined;

try {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const prismaConfig = require('../src/config/prisma');
  prisma = prismaConfig.prisma;
  connectPrisma = prismaConfig.connectPrisma;
  disconnectPrisma = prismaConfig.disconnectPrisma;
  /* eslint-enable @typescript-eslint/no-var-requires */
} catch {
  // Fallback for compiled environments where src is omitted (e.g., Docker production image)
  /* eslint-disable @typescript-eslint/no-var-requires */
  const prismaConfig = require('../dist/config/prisma.js');
  prisma = prismaConfig.prisma;
  connectPrisma = prismaConfig.connectPrisma;
  disconnectPrisma = prismaConfig.disconnectPrisma;
  /* eslint-enable @typescript-eslint/no-var-requires */
}

export { prisma, connectPrisma, disconnectPrisma };

export const isValidIranPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return /^09\d{9}$/.test(digits) || /^989\d{9}$/.test(digits);
};

export const normalizeIranPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('989') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  return digits;
};

export const validateUsername = (username: string): void => {
  const trimmed = (username || '').trim();
  if (trimmed.length < 3 || trimmed.length > 50) {
    throw new Error('Validation error: Username must be between 3 and 50 characters long.');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw new Error(
      'Validation error: Username can only contain letters, numbers, dots, underscores, and hyphens.'
    );
  }
};

export const validatePasswordPolicy = (password: string): void => {
  if (password.length < 8) {
    throw new Error('Validation error: Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Validation error: Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Validation error: Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Validation error: Password must contain at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    throw new Error('Validation error: Password must contain at least one special character.');
  }
};

export interface BootstrapOptions {
  username?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
}

export const promptInput = (rl: readline.Interface, query: string, hide = false): Promise<string> => {
  return new Promise((resolve) => {
    if (!hide) {
      rl.question(query, resolve);
    } else {
      process.stdout.write(query);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      let input = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString('utf8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.removeListener('data', onData);
          if (stdin.setRawMode) {
            stdin.setRawMode(wasRaw || false);
          }
          process.stdout.write('\n');
          resolve(input);
        } else if (c === '\u0003') {
          process.exit(1);
        } else if (c === '\b' || c === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += c;
        }
      };

      stdin.on('data', onData);
    }
  });
};

export async function bootstrapPlatformAdmin(opts: BootstrapOptions = {}) {
  // Check if any platform administrator already exists
  const existingCount = await prisma.platformAdmin.count();
  if (existingCount > 0) {
    console.warn('[Bootstrap] A platform administrator already exists. Refusing to create or overwrite.');
    return null;
  }

  let username = opts.username;
  let fullName = opts.fullName;
  let phone = opts.phone;
  let email = opts.email;
  let password = opts.password;
  let passwordConfirm = opts.passwordConfirm;

  const isInteractive = !username || !password || !passwordConfirm;

  if (isInteractive && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('====================================================');
    console.log('   PlayNest - First Platform Admin Bootstrap Wizard ');
    console.log('   (SUPERUSER + Mandatory TOTP 2FA on First Login)  ');
    console.log('====================================================');

    try {
      if (!username) {
        username = await promptInput(rl, '1. Username (required): ');
      }
      if (fullName === undefined) {
        fullName = await promptInput(rl, '2. Full Name (optional, defaults to username): ');
      }
      if (phone === undefined) {
        phone = await promptInput(rl, '3. Phone Number (optional, e.g. 09121234567): ');
      }
      if (email === undefined) {
        email = await promptInput(rl, '4. Email (optional): ');
      }
      if (!password) {
        password = await promptInput(rl, '5. Password: ', true);
      }
      if (!passwordConfirm) {
        passwordConfirm = await promptInput(rl, '6. Confirm Password: ', true);
      }
    } finally {
      rl.close();
    }
  }

  username = username?.trim();
  validateUsername(username || '');

  const normalizedFullName = (fullName?.trim() || username!).trim();
  if (normalizedFullName.length < 2) {
    throw new Error('Validation error: Full name must be at least 2 characters long.');
  }

  const trimmedPhone = phone?.trim();
  let normalizedPhone: string | null = null;
  if (trimmedPhone) {
    if (!isValidIranPhone(trimmedPhone)) {
      throw new Error('Validation error: Invalid Iranian phone number format.');
    }
    normalizedPhone = normalizeIranPhone(trimmedPhone);
  }

  const normalizedEmail = email?.trim() || undefined;

  if (!password) {
    throw new Error('Validation error: Password is required.');
  }

  if (passwordConfirm !== undefined && password !== passwordConfirm) {
    throw new Error('Validation error: Password confirmation does not match.');
  }

  validatePasswordPolicy(password);

  const passwordHash = await argon2.hash(password);

  // Execute atomically in a transaction: double-check uniqueness, create SUPERUSER with TOTP disabled until first login setup
  const admin = await prisma.$transaction(async (tx) => {
    const countInsideTx = await tx.platformAdmin.count();
    if (countInsideTx > 0) {
      throw new Error('Conflict: A platform administrator already exists.');
    }

    if (typeof tx.platformAdmin.findFirst === 'function') {
      const duplicateUsername = await tx.platformAdmin.findFirst({
        where: { username: { equals: username!, mode: 'insensitive' } },
      });
      if (duplicateUsername) {
        throw new Error('Conflict: A platform administrator with this username already exists.');
      }
    }

    const newAdmin = await tx.platformAdmin.create({
      data: {
        username: username!,
        fullName: normalizedFullName,
        phone: normalizedPhone,
        email: normalizedEmail,
        passwordHash,
        isActive: true,
        isSuperuser: true,
        totpEnabled: false,
        totpSetupCompleted: false,
        totpSecretEncrypted: null,
      },
    });

    await tx.auditLog.create({
      data: {
        platformAdminId: newAdmin.id,
        action: 'PLATFORM_ADMIN_BOOTSTRAP',
        entity: 'PlatformAdmin',
        entityId: newAdmin.id,
        newData: {
          id: newAdmin.id,
          username: newAdmin.username,
          fullName: newAdmin.fullName,
          phone: newAdmin.phone,
          email: newAdmin.email,
          isSuperuser: true,
          totpEnabled: false,
          totpSetupCompleted: false,
        },
      },
    });

    return newAdmin;
  });

  console.log('----------------------------------------------------');
  console.log('[Bootstrap] Successfully created first SUPERUSER (PLATFORM_ADMIN)');
  console.log(`Administrator ID:     ${admin.id}`);
  console.log(`Username:             ${admin.username}`);
  console.log(`Full Name:            ${admin.fullName}`);
  if (admin.phone) {
    console.log(`Phone:                ${admin.phone}`);
  }
  console.log('TOTP Enabled:         false (Mandatory 2FA setup on first login)');
  console.log('----------------------------------------------------');

  return admin;
}

/**
 * Audited emergency recovery CLI helper: resets 2FA enrollment for a PlatformAdmin
 * and revokes all active sessions, authenticators, and recovery codes so the admin
 * must complete mandatory 2FA setup upon next login.
 */
export async function resetPlatformAdminTwoFactor(identifier: string, reason = 'CLI_EMERGENCY_RESET') {
  const cleanIdentifier = (identifier || '').trim();
  if (!cleanIdentifier) {
    throw new Error('Validation error: Username, email, or phone is required for --reset-2fa.');
  }

  const admin = await prisma.platformAdmin.findFirst({
    where: {
      OR: [
        { username: { equals: cleanIdentifier, mode: 'insensitive' } },
        { email: { equals: cleanIdentifier, mode: 'insensitive' } },
        { phone: cleanIdentifier },
      ],
    },
  });

  if (!admin) {
    throw new Error(`Platform administrator "${cleanIdentifier}" not found.`);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.platformAdmin.update({
      where: { id: admin.id },
      data: {
        totpEnabled: false,
        totpSetupCompleted: false,
        totpSecretEncrypted: null,
        totpPendingSecretEncrypted: null,
        totpPendingCreatedAt: null,
        totpEnabledAt: null,
        totpFailedAttempts: 0,
        totpLockedUntil: null,
      },
    });

    await tx.platformAdminAuthenticator.updateMany({
      where: { platformAdminId: admin.id, status: { not: 'REVOKED' } },
      data: { status: 'REVOKED', isPrimary: false },
    });

    await tx.platformAdminRecoveryCode.updateMany({
      where: { platformAdminId: admin.id, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.session.updateMany({
      where: { actorType: 'PLATFORM_ADMIN', actorId: admin.id, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.auditLog.create({
      data: {
        platformAdminId: admin.id,
        action: 'ADMIN_2FA_EMERGENCY_RESET',
        entity: 'PlatformAdmin',
        entityId: admin.id,
        newData: {
          username: admin.username,
          reason,
          totpEnabled: false,
          totpSetupCompleted: false,
          resetAt: now.toISOString(),
        },
      },
    });
  });

  console.log(`[Emergency Reset] 2FA cleared and all sessions revoked for ${admin.username || admin.id}.`);
  return admin;
}

if (require.main === module) {
  (async () => {
    try {
      if (typeof connectPrisma === 'function') {
        await connectPrisma();
      }

      const args = process.argv.slice(2);
      const resetIdx = args.indexOf('--reset-2fa');
      if (resetIdx !== -1) {
        let targetUser = args[resetIdx + 1];
        if (!targetUser && process.stdin.isTTY) {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          try {
            targetUser = await promptInput(rl, 'Enter Platform Admin username to reset 2FA: ');
          } finally {
            rl.close();
          }
        }
        await resetPlatformAdminTwoFactor(targetUser || '');
      } else {
        await bootstrapPlatformAdmin();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Bootstrap Error]', errorMsg);
      process.exitCode = 1;
    } finally {
      if (typeof disconnectPrisma === 'function') {
        await disconnectPrisma();
      } else if (prisma && typeof (prisma as { $disconnect?: () => Promise<void> }).$disconnect === 'function') {
        await prisma.$disconnect();
      }
    }
  })();
}
