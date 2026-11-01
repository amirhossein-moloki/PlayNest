import readline from 'readline';
import argon2 from 'argon2';
import { prisma } from '../src/config/prisma';

export const isValidIranPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return /^09\d{9}$/.test(digits) || /^989\d{9}$/.test(digits);
};

interface BootstrapOptions {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
}

const prompt = (rl: readline.Interface, query: string, hide = false): Promise<string> => {
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
  let fullName = opts.fullName || process.env.PLATFORM_ADMIN_NAME;
  let phone = opts.phone || process.env.PLATFORM_ADMIN_PHONE;
  let email = opts.email || process.env.PLATFORM_ADMIN_EMAIL;
  let password = opts.password || process.env.PLATFORM_ADMIN_PASSWORD;

  const isInteractive = !fullName || !phone || !password;

  if (isInteractive && process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      if (!fullName) {
        fullName = await prompt(rl, 'Full Name: ');
      }
      if (!phone) {
        phone = await prompt(rl, 'Phone (e.g. 09121234567): ');
      }
      if (!email) {
        email = await prompt(rl, 'Email (optional): ');
      }
      if (!password) {
        password = await prompt(rl, 'Password: ', true);
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

  if (!password || password.length < 8) {
    throw new Error('Validation error: Password must be at least 8 characters long.');
  }

  // Idempotency: Check if an admin already exists with this phone or email
  const existingByPhone = await prisma.platformAdmin.findUnique({ where: { phone } });
  if (existingByPhone) {
    console.warn(`[Bootstrap] Platform admin with phone ${phone} already exists. Refusing to overwrite.`);
    return existingByPhone;
  }

  if (email) {
    const existingByEmail = await prisma.platformAdmin.findUnique({ where: { email } });
    if (existingByEmail) {
      console.warn(`[Bootstrap] Platform admin with email ${email} already exists. Refusing to overwrite.`);
      return existingByEmail;
    }
  }

  const passwordHash = await argon2.hash(password);

  const admin = await prisma.platformAdmin.create({
    data: {
      fullName,
      phone,
      email,
      passwordHash,
      isActive: true,
      isSuperuser: true,
    },
  });

  console.log(`[Bootstrap] Successfully created PLATFORM_ADMIN: ${admin.fullName} (${admin.phone}) [ID: ${admin.id}]`);
  return admin;
}

if (require.main === module) {
  bootstrapPlatformAdmin()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Bootstrap Error]', err.message || err);
      process.exit(1);
    });
}
