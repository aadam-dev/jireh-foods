/**
 * Reset a staff password.
 *
 *   node prisma/reset-password.mjs it@jireh.com
 *
 * Prompts for the new password with the terminal echo turned off, hashes it
 * with the same bcrypt cost the app uses (12), and writes only the hash. The
 * plaintext never reaches argv, so it stays out of your shell history and out
 * of any process listing.
 *
 * Run it from the project root so .env is picked up.
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { Writable } from 'node:stream';

config({ path: '.env.local' });
config({ path: '.env' });

const email = (process.argv[2] ?? '').toLowerCase().trim();
if (!email) {
  console.error('Usage: node prisma/reset-password.mjs <email>');
  process.exit(1);
}

/** Prompt without echoing what is typed. */
function askHidden(question) {
  return new Promise(resolve => {
    let muted = false;
    const mutedOut = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) process.stdout.write(chunk, encoding);
        callback();
      },
    });
    const rl = readline.createInterface({ input: process.stdin, output: mutedOut, terminal: true });
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user) {
    console.error(`No account found for ${email}`);
    process.exit(1);
  }

  console.log(`Account: ${user.name} (${user.role})${user.isActive ? '' : '  — INACTIVE'}`);

  const pw = await askHidden('New password: ');
  const confirm = await askHidden('Confirm password: ');

  if (pw !== confirm) {
    console.error('Passwords did not match. Nothing changed.');
    process.exit(1);
  }
  if (pw.length < 8) {
    console.error('Use at least 8 characters. Nothing changed.');
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    // Cost 12 matches the existing hashes in the database.
    data: { password: await bcrypt.hash(pw, 12), passwordResetRequired: false },
  });

  console.log(`Password updated for ${user.email}.`);
} finally {
  await prisma.$disconnect();
}
