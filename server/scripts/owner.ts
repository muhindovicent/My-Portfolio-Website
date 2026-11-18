import 'dotenv/config';
import { open } from 'node:fs/promises';
import { issueReset, provision } from '../src/lib/owner';
import { db } from '../src/config/db';
async function main() {
  const [action,file] = process.argv.slice(2);
  if (!file || !['provision','enroll-legacy','issue-reset'].includes(action)) throw Error('Expected action and new private output file');
  const out = await open(file,'wx',0o600);
  try {
    const value = action === 'issue-reset' ? await issueReset() : await provision(process.env.OWNER_EMAIL!, process.env.OWNER_PASSWORD!, process.env.OWNER_TOTP_SEED!, action === 'enroll-legacy');
    await out.writeFile(JSON.stringify(value)+'\n');
  } finally { await out.close(); }
}
main().catch(()=>{console.error('Owner operation failed. Verify input, file permissions and provisioning state.');process.exitCode=1;}).finally(()=>db.$disconnect());
