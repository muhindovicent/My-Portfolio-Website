// Verifies the Portfolio Studio shell, auth guard, dashboard data and search
// against a real PostgreSQL database. Requires a disposable local database.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const request = require('supertest');
const otp = require('speakeasy');

const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.pathname !== '/phase3c_staging') {
  throw Error('Use disposable local phase3c_staging database');
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  SESSION_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
});

const app = require('../dist/src/app').default;
const { db } = require('../dist/src/config/db');
const { provision } = require('../dist/src/lib/owner');

const email = 'studio@example.test';
const password = randomBytes(24).toString('hex');
const seed = otp.generateSecret().base32;
const slug = `studio-project-${Date.now()}`;

let owner;
let agent;
let csrf;

async function login() {
  agent = request.agent(app);
  csrf = (await agent.get('/api/admin/auth/csrf-token').expect(200)).body.csrfToken;
  const step = await agent.post('/api/admin/auth/login').set('X-CSRF-Token', csrf)
    .send({ email, password }).expect(202);
  csrf = step.body.csrfToken;
  const done = await agent.post('/api/admin/auth/login/mfa').set('X-CSRF-Token', csrf)
    .send({ token: otp.totp({ secret: seed, encoding: 'base32' }) }).expect(200);
  csrf = done.body.csrfToken;
}

before(async () => {
  await provision(email, password, seed);
  owner = await db.administrator.findUniqueOrThrow({ where: { email } });
  await login();
  await db.project.create({ data: { slug, name: 'Studio Verify Project', status: 'PUBLISHED', sortOrder: 1 } });
  await db.contactMessage.create({ data: { name: 'Ada', email: 'ada@example.test', message: 'Hello from the studio test' } });
});

after(async () => {
  if (!owner) return;
  await db.$transaction([
    db.session.deleteMany({ where: { adminId: owner.id } }),
    db.securityEvent.deleteMany({ where: { adminId: owner.id } }),
    db.passwordResetToken.deleteMany({ where: { adminId: owner.id } }),
    db.backupCode.deleteMany({ where: { adminId: owner.id } }),
    db.mfaSecret.deleteMany({ where: { adminId: owner.id } }),
    db.project.deleteMany({ where: { slug } }),
    db.contactMessage.deleteMany({ where: { email: 'ada@example.test' } }),
    db.administrator.delete({ where: { id: owner.id } }),
  ]);
  await db.$disconnect();
});

test('studio shell is auth-gated and served with accessible landmarks', async () => {
  const anon = await request(app).get('/admin');
  assert.equal(anon.status, 302);
  assert.match(anon.headers.location, /^\/admin\/login$/);

  const loginPage = await request(app).get('/admin/login');
  assert.equal(loginPage.status, 200);
  assert.match(loginPage.text, /Portfolio Studio/);
  assert.match(loginPage.text, /Skip to content/);
  assert.match(loginPage.text, /<\/html>/);

  const authed = await agent.get('/admin').redirects(0);
  assert.equal(authed.status, 200);
  assert.match(authed.text, /id="sidebar"/);
  assert.match(authed.text, /aria-label="Breadcrumb"/);
  assert.match(authed.text, /id="notifications-toggle"/);
  assert.match(authed.text, /id="theme-toggle"/);
});

test('studio static assets are served and reference real routes', async () => {
  const css = await agent.get('/admin/assets/studio.css');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /css/);
  const js = await agent.get('/admin/assets/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
  for (const route of ['/admin/projects', '/admin/about', '/admin/education', '/admin/experience',
    '/admin/leadership', '/admin/certifications', '/admin/skills', '/admin/media',
    '/admin/messages', '/admin/settings', '/admin/security']) {
    const page = await agent.get(route).redirects(0);
    assert.equal(page.status, 200, `${route} should render a dedicated page`);
    assert.match(page.text, /<\/html>/);
  }
});

test('dashboard reports database-derived statistics and activity', async () => {
  const { body } = await agent.get('/api/admin/dashboard').expect(200);
  assert.equal(body.data.stats.projects.total, 1);
  assert.equal(body.data.stats.projects.published, 1);
  assert.equal(body.data.stats.messages.unread, 1);
  assert.ok(Array.isArray(body.data.activity));
  assert.ok(Array.isArray(body.data.security));
  // No fabricated records: activity only exists if the database contains it.
  const auditCount = await db.auditLog.count();
  assert.equal(body.data.activity.length, Math.min(auditCount, 8));
});

test('notifications expose unread messages from the database', async () => {
  const { body } = await agent.get('/api/admin/dashboard/notifications').expect(200);
  assert.equal(body.data.unread, 1);
  assert.equal(body.data.messages.length, 1);
  assert.equal(body.data.messages[0].name, 'Ada');
});

test('search returns real records and ignores unknown terms', async () => {
  const hit = await agent.get(`/api/admin/dashboard/search?q=${encodeURIComponent('Studio Verify')}`).expect(200);
  assert.equal(hit.body.data.total, 1);
  assert.equal(hit.body.data.projects[0].slug, slug);

  const miss = await agent.get('/api/admin/dashboard/search?q=definitely-not-present-xyz').expect(200);
  assert.equal(miss.body.data.total, 0);

  await agent.get('/api/admin/dashboard/search?q=').expect(400);
});

test('dashboard mutations still require CSRF', async () => {
  const rejected = await agent.post('/api/admin/projects').send({ name: 'No CSRF' });
  assert.equal(rejected.status, 403);
  const created = await agent.post('/api/admin/projects').set('X-CSRF-Token', csrf)
    .send({ slug: `csrf-check-${Date.now()}`, name: 'CSRF Check', status: 'DRAFT' }).expect(201);
  assert.ok(created.body.data.id);
  await db.project.delete({ where: { id: created.body.data.id } });
});
