import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '../config/db';
import { hashPassword } from './password';

export const digest = (value:string) => createHash('sha256').update(value).digest('hex');
export const password = z.string().min(12).refine(p => Buffer.byteLength(p) <= 72, 'Password exceeds bcrypt byte limit');
function key() { return Buffer.from(z.string().regex(/^[a-f0-9]{64}$/i).parse(process.env.ENCRYPTION_KEY),'hex'); }
function seal(secret:string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key(),iv);
  const body = Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
}
export function unseal(value:string) {
  const b = Buffer.from(value,'base64'), cipher = createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));
  cipher.setAuthTag(b.subarray(12,28));
  return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8');
}
// The operator creates the TOTP seed in their authenticator before provisioning.
export async function provision(email:string, pass:string, seed:string, enrollLegacy=false) {
  email = z.string().email().parse(email).toLowerCase();
  const ciphertext = seal(z.string().regex(/^[A-Z2-7]{32,64}$/).parse(seed));
  const passwordHash = await hashPassword(password.parse(pass));
  const codes = Array.from({length:8},() => randomBytes(16).toString('hex'));
  await db.$transaction(async tx => {
    const existing = await tx.administrator.findFirst();
    if (existing && (!enrollLegacy || existing.email.toLowerCase() !== email)) throw Error('Owner already provisioned');
    if (!existing && enrollLegacy) throw Error('No existing owner');
    const owner = existing ? await tx.administrator.update({where:{id:existing.id},data:{passwordHash,sessionVersion:{increment:1}}}) : await tx.administrator.create({data:{email,passwordHash}});
    await tx.mfaSecret.create({data:{adminId:owner.id,ciphertext,enabled:true}});
    await tx.backupCode.createMany({data:codes.map(code=>({adminId:owner.id,codeHash:digest(code)}))});
    await tx.securityEvent.create({data:{action:'PROVISION_OWNER',entity:'Administrator',adminId:owner.id,ipAddress:'local-cli'}});
  });
  return codes;
}
// Only accessible to the trusted operator. No HTTP reset-token issuance or delivery channel.
export async function issueReset() {
  const owner = await db.administrator.findFirstOrThrow({where:{isActive:true}});
  const token = randomBytes(32).toString('hex');
  await db.$transaction([db.passwordResetToken.deleteMany({where:{adminId:owner.id}}),
    db.passwordResetToken.create({data:{adminId:owner.id,tokenHash:digest(token),expiresAt:new Date(Date.now()+900000)}}),
    db.securityEvent.create({data:{action:'RECOVERY_REQUEST',entity:'Administrator',adminId:owner.id,ipAddress:'local-cli'}})]);
  return token;
}
