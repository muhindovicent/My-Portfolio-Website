const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {randomBytes} = require('node:crypto');
const request = require('supertest');
const otp = require('speakeasy');
// Refuse non-local or non-test databases; cleanup only a fixture created by this suite.
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.pathname !== '/phase3b_test') throw Error('Use disposable local phase3b_test database');
Object.assign(process.env,{NODE_ENV:'test',SESSION_SECRET:randomBytes(32).toString('hex'),ENCRYPTION_KEY:randomBytes(32).toString('hex')});
const app=require('../dist/src/app').default;
const {db}=require('../dist/src/config/db');
const {provision,issueReset}=require('../dist/src/lib/owner');
const root='/api/admin/auth', email='integration@example.test', pass=randomBytes(24).toString('hex'), seed=otp.generateSecret().base32;
let codes, owner;
async function start(password=pass) {
  const agent=request.agent(app), csrf=(await agent.get(root+'/csrf-token').expect(200)).body.csrfToken;
  const login=await agent.post(root+'/login').set('X-CSRF-Token',csrf).send({email,password});
  return {agent,login,csrf:login.body.csrfToken};
}
before(async()=>{codes=await provision(email,pass,seed);owner=await db.administrator.findUniqueOrThrow({where:{email}});});
after(async()=>{if(owner){await db.$transaction([db.session.deleteMany({where:{adminId:owner.id}}),db.securityEvent.deleteMany({where:{adminId:owner.id}}),db.passwordResetToken.deleteMany({where:{adminId:owner.id}}),db.backupCode.deleteMany({where:{adminId:owner.id}}),db.mfaSecret.deleteMany({where:{adminId:owner.id}}),db.administrator.delete({where:{id:owner.id}})]);}await db.$disconnect();});
test('database rejects another owner; enrollment is private; anonymous and invalid credentials denied',async()=>{
  await assert.rejects(db.administrator.create({data:{email:'other@example.test',passwordHash:'unused'}}),{code:'P2002'});
  await request(app).get('/api/admin/projects').expect(401);
  await request(app).post(root+'/setup').expect(403);
  assert.equal((await start('incorrect')).login.status,401);
  const factor=await db.mfaSecret.findUniqueOrThrow({where:{adminId:owner.id}});assert.ok(!factor.ciphertext.includes(seed));
});
test('password alone denied; real TOTP grants persistent cookie session; logout revokes it',async()=>{
  const {agent,login,csrf}=await start();assert.equal(login.status,202);
  await agent.get('/api/admin/projects').expect(403);
  const verify=await agent.post(root+'/login/mfa').set('X-CSRF-Token',csrf).send({token:otp.totp({secret:seed,encoding:'base32'})}).expect(200);
  const cookie=verify.headers['set-cookie'][0].split(';')[0];
  await agent.get('/api/admin/projects').expect(200);
  await agent.post(root+'/logout').expect(403);
  await agent.post(root+'/logout').set('X-CSRF-Token',verify.body.csrfToken).expect(204);
  await request(app).get(root+'/me').set('Cookie',cookie).expect(401);
});
test('arbitrary backup code is single-use; recovery revokes authenticated and pending sessions',async()=>{
  const a=await start(), b=await start();assert.equal(a.login.status,202);assert.equal(b.login.status,202);
  const verified=await a.agent.post(root+'/login/backup-code').set('X-CSRF-Token',a.csrf).send({code:codes[6]}).expect(200);
  await b.agent.post(root+'/login/backup-code').set('X-CSRF-Token',b.csrf).send({code:codes[6]}).expect(401);
  const token=await issueReset(), password=randomBytes(16).toString('hex');
  await a.agent.post(root+'/recovery/verify').set('X-CSRF-Token',verified.body.csrfToken).send({token,password}).expect(204);
  await a.agent.get(root+'/me').expect(401);await b.agent.get(root+'/me').expect(401);
  const c=await start(password);assert.equal(c.login.status,202);
  await c.agent.post(root+'/recovery/verify').set('X-CSRF-Token',c.csrf).send({token,password}).expect(400);
  await db.session.updateMany({where:{adminId:owner.id},data:{expiresAt:new Date(0)}});
  await c.agent.get(root+'/me').expect(401);
});
test('factor and recovery guesses have separate verification budgets',async()=>{
  const a=request.agent(app),csrf=(await a.get(root+'/csrf-token')).body.csrfToken;
  for(const [path,body] of [['/login/mfa',{token:'000000'}],['/recovery/verify',{token:'0'.repeat(64),password:pass}]]) {
    let status;for(let n=0;n<9;n++) status=(await a.post(root+path).set('X-CSRF-Token',csrf).send(body)).status;
    assert.equal(status,429);
  }
});
