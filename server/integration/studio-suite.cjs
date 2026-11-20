// Portfolio Studio integration tests.
// Verifies login, MFA, backup-code auth, CRUD, validation and status filtering
// against a disposable PostgreSQL database. Requires a local PostgreSQL instance.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const request = require('supertest');
const otp = require('speakeasy');

// Refuse non-local or non-test databases; cleanup only fixtures created by this suite.
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.pathname !== '/studio_test') {
  throw Error('Use disposable local studio_test database');
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
});

execFileSync(
  process.platform === 'win32' ? 'cmd.exe' : 'npx',
  process.platform === 'win32' ? ['/c', 'npx', 'prisma', 'migrate', 'deploy'] : ['prisma', 'migrate', 'deploy'],
  { stdio: 'inherit' },
);

const app = require('../dist/src/app').default;
const { db } = require('../dist/src/config/db');
const { provision } = require('../dist/src/lib/owner');

const root = '/api/admin/auth';
const email = 'suite@example.test';
const password = randomBytes(24).toString('hex');
const seed = otp.generateSecret().base32;
const projectSlug = `suite-project-${Date.now()}`;

let owner;
let backupCodes;
let agent;
let csrf;

async function getCsrf(agent_) {
  return (await agent_.get(`${root}/csrf-token`).expect(200)).body.csrfToken;
}

async function loginWithMFA(agent_, token) {
  const csrf_ = await getCsrf(agent_);
  const step = await agent_.post(`${root}/login`).set('X-CSRF-Token', csrf_)
    .send({ email, password }).expect(202);
  assert.equal(step.status, 202);
  assert.equal(step.body.mfaRequired, true);
  if (owner?.id) {
    await db.mfaSecret.updateMany({ where: { adminId: owner.id }, data: { lastStep: 0 } });
  }
  const done = await agent_.post(`${root}/login/mfa`).set('X-CSRF-Token', step.body.csrfToken)
    .send({ token }).expect(200);
  assert.equal(done.body.ok, true);
  return done.body.csrfToken;
}

before(async () => {
  backupCodes = await provision(email, password, seed);
  owner = await db.administrator.findUniqueOrThrow({ where: { email } });
  agent = request.agent(app);
  csrf = await loginWithMFA(agent, otp.totp({ secret: seed, encoding: 'base32' }));
  await db.project.create({
    data: { slug: projectSlug, name: 'Suite Project', status: 'PUBLISHED', sortOrder: 1 },
  });
});

after(async () => {
  if (!owner) return;
  await db.$transaction([
    db.session.deleteMany({ where: { adminId: owner.id } }),
    db.securityEvent.deleteMany({ where: { adminId: owner.id } }),
    db.passwordResetToken.deleteMany({ where: { adminId: owner.id } }),
    db.backupCode.deleteMany({ where: { adminId: owner.id } }),
    db.mfaSecret.deleteMany({ where: { adminId: owner.id } }),
    db.project.deleteMany({ where: { slug: { contains: 'suite-project-' } } }),
    db.administrator.delete({ where: { id: owner.id } }),
  ]);
  await db.$disconnect();
});

describe('Authentication', () => {
  test('rejects anonymous access to protected CRUD', async () => {
    await request(app).get('/api/admin/projects').expect(401);
    await request(app).post('/api/admin/projects').expect(401);
  });

  test('login: password-only returns 202 and requires MFA', async () => {
    const anon = request.agent(app);
    const c = await getCsrf(anon);
    const res = await anon.post(`${root}/login`).set('X-CSRF-Token', c)
      .send({ email, password }).expect(202);
    assert.equal(res.body.mfaRequired, true);
    assert.ok(res.body.csrfToken);
    // Without MFA, protected endpoints are still forbidden
    await anon.get('/api/admin/projects').expect(403);
  });

  test('login: invalid credentials rejected', async () => {
    const anon = request.agent(app);
    const c = await getCsrf(anon);
    await anon.post(`${root}/login`).set('X-CSRF-Token', c)
      .send({ email, password: 'wrong-password' }).expect(401);
  });

  test('MFA: valid TOTP grants session and /auth/me returns admin', async () => {
    const anon = request.agent(app);
    const c = await loginWithMFA(anon, otp.totp({ secret: seed, encoding: 'base32' }));
    const me = await anon.get(`${root}/me`).set('X-CSRF-Token', c).expect(200);
    assert.equal(me.body.admin.email, email);
    assert.ok(me.body.admin.id);
  });

  test('MFA: invalid TOTP rejected', async () => {
    const anon = request.agent(app);
    const c = await getCsrf(anon);
    const step = await anon.post(`${root}/login`).set('X-CSRF-Token', c)
      .send({ email, password }).expect(202);
    await anon.post(`${root}/login/mfa`).set('X-CSRF-Token', step.body.csrfToken)
      .send({ token: '000000' }).expect(401);
  });

  test('backup-code: single-use authentication', async () => {
    const anon = request.agent(app);
    const c = await getCsrf(anon);
    const first = await anon.post(`${root}/login`).set('X-CSRF-Token', c)
      .send({ email, password }).expect(202);
    const code = backupCodes[0];
    const verified = await anon.post(`${root}/login/backup-code`)
      .set('X-CSRF-Token', first.body.csrfToken).send({ code }).expect(200);
    assert.equal(verified.body.ok, true);

    const replay = request.agent(app);
    const replayCsrf = await getCsrf(replay);
    const replayLogin = await replay.post(`${root}/login`).set('X-CSRF-Token', replayCsrf)
      .send({ email, password }).expect(202);
    await replay.post(`${root}/login/backup-code`)
      .set('X-CSRF-Token', replayLogin.body.csrfToken).send({ code }).expect(401);
  });
});

describe('CRUD — projects (slug-based)', () => {
  test('create project via form submission shape', async () => {
    const slug = `create-test-${Date.now()}`;
    const created = await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug, name: 'Create Test Project', status: 'DRAFT' }).expect(201);
    assert.ok(created.body.ok);
    assert.equal(created.body.data.slug, slug);
    assert.equal(created.body.data.name, 'Create Test Project');
    assert.equal(created.body.data.status, 'DRAFT');
    await db.project.delete({ where: { id: created.body.data.id } });
  });

  test('list projects returns paginated envelope with data and meta', async () => {
    const res = await agent.get('/api/admin/projects').set('X-CSRF-Token', csrf).expect(200);
    assert.ok(res.body.ok);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    assert.ok(typeof res.body.meta.total === 'number');
    assert.ok(typeof res.body.meta.totalPages === 'number');
    assert.ok(typeof res.body.meta.page === 'number');
    assert.ok(typeof res.body.meta.limit === 'number');
  });

  test('get project by slug', async () => {
    const res = await agent.get(`/api/admin/projects/${encodeURIComponent(projectSlug)}`)
      .set('X-CSRF-Token', csrf).expect(200);
    assert.ok(res.body.ok);
    assert.equal(res.body.data.slug, projectSlug);
    assert.equal(res.body.data.name, 'Suite Project');
  });

  test('update project by slug (not id)', async () => {
    const updated = await agent.patch(`/api/admin/projects/${encodeURIComponent(projectSlug)}`)
      .set('X-CSRF-Token', csrf).send({ name: 'Updated Suite Project' }).expect(200);
    assert.ok(updated.body.ok);
    assert.equal(updated.body.data.name, 'Updated Suite Project');
    assert.equal(updated.body.data.slug, projectSlug);
  });

  test('delete project by slug (not id)', async () => {
    const slug = `delete-test-${Date.now()}`;
    await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug, name: 'Delete Test', status: 'DRAFT' }).expect(201);
    const removed = await agent.delete(`/api/admin/projects/${encodeURIComponent(slug)}`)
      .set('X-CSRF-Token', csrf).expect(200);
    assert.ok(removed.body.ok);
    assert.equal(removed.body.data.id, removed.body.data.id);
    const gone = await agent.get(`/api/admin/projects/${encodeURIComponent(slug)}`)
      .set('X-CSRF-Token', csrf).expect(404);
  });

  test('CRUD requires CSRF token on state-changing requests', async () => {
    const noCsrf = await agent.post('/api/admin/projects')
      .send({ slug: 'no-csrf-test', name: 'No CSRF' });
    assert.equal(noCsrf.status, 403);
  });

  test('validation: rejects invalid slug', async () => {
    const res = await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug: 'Invalid_Slug', name: 'Bad Slug' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'ValidationError');
  });

  test('validation: rejects missing required fields', async () => {
    const res = await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ name: 'Missing Slug' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'ValidationError');
  });

  test('validation: rejects duplicate slug', async () => {
    const slug = `dup-test-${Date.now()}`;
    await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug, name: 'Dup 1', status: 'DRAFT' }).expect(201);
    const dup = await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug, name: 'Dup 2', status: 'DRAFT' });
    assert.equal(dup.status, 409);
    await db.project.delete({ where: { slug } });
  });
});

describe('Status filtering', () => {
  test('filter projects by status returns only matching records', async () => {
    const publishedSlug = `status-pub-${Date.now()}`;
    const draftSlug = `status-draft-${Date.now()}`;
    await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug: publishedSlug, name: 'Status Published', status: 'PUBLISHED' }).expect(201);
    await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
      .send({ slug: draftSlug, name: 'Status Draft', status: 'DRAFT' }).expect(201);
    try {
      const published = await agent.get('/api/admin/projects?status=PUBLISHED')
        .set('X-CSRF-Token', csrf).expect(200);
      const pubSlugs = published.body.data.map((r) => r.slug);
      assert.ok(pubSlugs.includes(publishedSlug));
      assert.ok(!pubSlugs.includes(draftSlug));
      const draft = await agent.get('/api/admin/projects?status=DRAFT')
        .set('X-CSRF-Token', csrf).expect(200);
      const draftSlugs = draft.body.data.map((r) => r.slug);
      assert.ok(draftSlugs.includes(draftSlug));
      assert.ok(!draftSlugs.includes(publishedSlug));
    } finally {
      await db.project.deleteMany({ where: { slug: { in: [publishedSlug, draftSlug] } } });
    }
  });
});

describe('Session cleanup', () => {
  test('logout revokes session', async () => {
    await agent.post(`${root}/logout`).set('X-CSRF-Token', csrf).expect(204);
    await agent.get(`${root}/me`).expect(401);
  });
});
