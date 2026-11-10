import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

/** Migrates and seeds the test database once before the API tests. */
export default function globalSetup() {
  const env = { ...process.env, ...dotenv.config({ path: path.join(__dirname, '..', '.env.test'), quiet: true }).parsed, NODE_ENV: 'test' };
  const cwd = path.join(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'ignore' });
}
