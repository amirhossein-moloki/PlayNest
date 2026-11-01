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

  let fullName = opts.fullName;
  let phone = opts.phone;
  let email = opts.email;
  let password = opts.password;
  let passwordConfirm = opts.passwordConfirm;

  const isInteractive = !fullName || !phone || !password || !passwordConfirm;

  if (isInteractive && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('====================================================');
    console.log('   PlayNest - First Platform Admin Bootstrap Wizard  ');
    console.log('====================================================');

    try {
      if (!fullName) {
        fullName = await promptInput(rl, '1. Full Name: ');
      }
      if (!phone) {
        phone = await promptInput(rl, '2. Phone Number (e.g. 09121234567): ');
      }
      if (!password) {
        password = await promptInput(rl, '3. Password: ', true);
      }
      if (!passwordConfirm) {
        passwordConfirm = await promptInput(rl, '4. Confirm Password: ', true);
      }
    } finally {
      rl.close();
    }
  }

  fullName = fullName?.trim();
  phone = phone?.trim();
  email = email?.trim() || undefined;

  if (!fullName || fullName.length < 2) {
    throw new Error('Validation error: Full name must be at least 2 characters long.');
  }

  if (!phone || !isValidIranPhone(phone)) {
    throw new Error('Validation error: Invalid Iranian phone number format.');
  }

  const normalizedPhone = normalizeIranPhone(phone);

  if (!password) {
    throw new Error('Validation error: Password is required.');
  }

  if (passwordConfirm !== undefined && password !== passwordConfirm) {
    throw new Error('Validation error: Password confirmation does not match.');
  }

  validatePasswordPolicy(password);

  const passwordHash = await argon2.hash(password);

  // Execute atomically in a transaction: double check count, create admin, and record audit log
  const admin = await prisma.$transaction(async (tx) => {
    const countInsideTx = await tx.platformAdmin.count();
    if (countInsideTx > 0) {
      throw new Error('Conflict: A platform administrator already exists.');
    }

    const newAdmin = await tx.platformAdmin.create({
      data: {
        fullName: fullName!,
        phone: normalizedPhone,
        email,
        passwordHash,
        isActive: true,
        isSuperuser: true,
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
          fullName: newAdmin.fullName,
          phone: newAdmin.phone,
          email: newAdmin.email,
        },
      },
    });

    return newAdmin;
  });

  console.log('----------------------------------------------------');
  console.log('[Bootstrap] Successfully created first PLATFORM_ADMIN');
  console.log(`Administrator ID: ${admin.id}`);
  console.log(`Full Name:        ${admin.fullName}`);
  console.log(`Phone:            ${admin.phone}`);
  console.log('----------------------------------------------------');

  return admin;
}

if (require.main === module) {
  (async () => {
    try {
      if (typeof connectPrisma === 'function') {
        await connectPrisma();
      }
      await bootstrapPlatformAdmin();
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
