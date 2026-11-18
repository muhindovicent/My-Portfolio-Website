import { Request, Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import speakeasy from 'speakeasy';
import { db } from '../../config/db';
import { AppError } from '../../middleware/error';
import { requireAdmin } from '../../middleware/auth';
import { csrfMiddleware, generateCsrfToken } from '../../lib/csrf';
import { hashPassword, comparePassword } from '../../lib/password';
import { digest, password, unseal } from '../../lib/owner';

const router = Router();
const limit = () => rateLimit({windowMs:900000,max:8,standardHeaders:true,legacyHeaders:false});
// One owner, one Render instance: a second shared budget also limits distributed guesses.
const ownerBudget = () => rateLimit({windowMs:900000,max:24,keyGenerator:()=>'owner',standardHeaders:true,legacyHeaders:false});
const factorLimit = limit(); // Shared budget for TOTP and backup codes.
const event = (req:Request,action:string,adminId?:string) => db.securityEvent.create({data:{action,entity:'Administrator',ipAddress:req.ip || 'unknown',adminId}});
const rotate = (req:Request) => new Promise<void>((ok,fail)=>req.session.regenerate(e=>e?fail(e):ok()));
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/csrf-token',(req,res)=>res.json({csrfToken:req.session.csrfToken ??= generateCsrfToken()}));
router.use(csrfMiddleware);
router.post('/login',limit(),ownerBudget(),async (req,res)=>{
  const input = z.object({email:z.string().email(),password:z.string().max(1024)}).parse(req.body);
  const owner = await db.administrator.findUnique({where:{email:input.email.toLowerCase()},include:{mfaSecret:{select:{enabled:true}}}});
  if (!owner?.isActive || !owner.mfaSecret?.enabled || !await comparePassword(input.password,owner.passwordHash)) {
    await event(req,'LOGIN_FAILED'); throw new AppError('Invalid credentials',401);
  }
  await rotate(req);
  req.session.adminId=owner.id; req.session.version=owner.sessionVersion;
  req.session.cookie.maxAge=300000;
  await event(req,'PASSWORD_VERIFIED',owner.id);
  res.status(202).json({mfaRequired:true,csrfToken:req.session.csrfToken=generateCsrfToken()});
});
router.post(['/login/mfa','/login/backup-code'],factorLimit,ownerBudget(),async(req,res)=>{
  const id=req.session.adminId, version=req.session.version;
  if (!id || version===undefined || req.session.mfaVerified) throw new AppError('Pending login required',401);
  const owner=await db.administrator.findFirst({where:{id,isActive:true,sessionVersion:version},include:{mfaSecret:true}});
  if (!owner?.mfaSecret?.enabled) throw new AppError('Login expired',401);
  let accepted=false;
  if(req.path.endsWith('backup-code')) {
    const code=z.string().regex(/^[0-9a-f]{32}$/).parse(req.body.code);
    accepted=(await db.backupCode.updateMany({where:{adminId:id,used:false,codeHash:digest(code)},data:{used:true,usedAt:new Date()}})).count===1;
  } else {
    const token=z.string().regex(/^\d{6}$/).parse(req.body.token);
    const step=Math.floor(Date.now()/30000);
    const delta=speakeasy.totp.verifyDelta({secret:unseal(owner.mfaSecret.ciphertext),encoding:'base32',token,time:step*30,window:1});
    if(delta) accepted=(await db.mfaSecret.updateMany({where:{id:owner.mfaSecret.id,lastStep:{lt:step+delta.delta}},data:{lastStep:step+delta.delta}})).count===1;
  }
  if(!accepted){await event(req,'MFA_FAILED',id);throw new AppError('Invalid verification code',401);}
  await rotate(req);req.session.adminId=id;req.session.version=version;req.session.mfaVerified=true;
  req.session.cookie.maxAge=8*3600000;
  await event(req,'LOGIN',id);
  res.json({ok:true,csrfToken:req.session.csrfToken=generateCsrfToken()});
});
router.post('/recovery/verify',limit(),ownerBudget(),async(req,res)=>{
  const input=z.object({token:z.string().regex(/^[0-9a-f]{64}$/),password}).parse(req.body);
  const record=await db.passwordResetToken.findUnique({where:{tokenHash:digest(input.token)}});
  if(!record || record.used || record.expiresAt<=new Date()) throw new AppError('Invalid or expired token',400);
  const passwordHash=await hashPassword(input.password);
  await db.$transaction(async tx=>{
    if(!(await tx.passwordResetToken.updateMany({where:{id:record.id,used:false,expiresAt:{gt:new Date()}},data:{used:true}})).count) throw new AppError('Invalid or expired token',400);
    await tx.administrator.update({where:{id:record.adminId},data:{passwordHash,sessionVersion:{increment:1}}});
    await tx.session.deleteMany({where:{adminId:record.adminId}});
    await tx.securityEvent.create({data:{action:'RECOVERY_COMPLETE',adminId:record.adminId,entity:'Administrator',ipAddress:req.ip || 'unknown'}});
  });res.sendStatus(204);
});
router.get('/me',requireAdmin,(req,res)=>res.json({admin:(req as any).admin}));
router.post('/logout',requireAdmin,async(req,res)=>{
  await event(req,'LOGOUT',req.session.adminId);
  await new Promise<void>((ok,fail)=>req.session.destroy(e=>e?fail(e):ok()));
  res.clearCookie('connect.sid',{path:'/'}).sendStatus(204);
});
export default router;
