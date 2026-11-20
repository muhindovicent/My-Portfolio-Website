import { execFileSync } from 'node:child_process';

export default async function globalSetup() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required for browser tests');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/studio_test') {
    throw new Error('Use disposable local studio_test database for browser tests');
  }
  execFileSync(
    process.platform === 'win32' ? 'cmd.exe' : 'npx',
    process.platform === 'win32' ? ['/c', 'npx', 'prisma', 'migrate', 'deploy'] : ['prisma', 'migrate', 'deploy'],
    { stdio: 'inherit' },
  );
}
