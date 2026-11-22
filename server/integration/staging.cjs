const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const request = require('supertest');

test('isolated staging proxy, origin gate and PostgreSQL-backed secure session', async () => {
  const db = new URL(process.env.DATABASE_URL);
  assert.equal(db.hostname, '127.0.0.1');
  assert.equal(db.pathname, '/studio_test');
  const secret = () => randomBytes(32).toString('hex');
  Object.assign(process.env, { VERCEL_ENV: 'preview', RENDER_API_ORIGIN: 'https://example-staging.onrender.com',
    NODE_ENV: 'production', CORS_ORIGIN: 'https://staging.example.test', SESSION_SECRET: secret(),
    ORIGIN_SECRET: secret(), ENCRYPTION_KEY: secret() });
  const preview = await import('../../vercel.mjs?preview');
  assert.equal(preview.config.routes.length, 1);
  assert.equal(preview.config.routes[0].dest, '/work/_project/index.html');
  assert.equal(preview.config.routes.some(r => r.src.startsWith('/api') || r.src.startsWith('/admin')), false);
  process.env.VERCEL_ENV = 'production'; // dedicated staging Vercel project
  const staging = await import('../../vercel.mjs?staging');
  const route = staging.config.routes.find(r => r.src === '/api/(.*)');
  assert.equal(route.dest, `${process.env.RENDER_API_ORIGIN}/api/$1`);
  assert.equal(route.transforms[0].args, '$ORIGIN_SECRET');
  assert.ok(staging.config.routes.some(r => r.dest === '/work/_project/index.html'));
  const app = require('../dist/src/app').default;
  const prisma = require('../dist/src/config/db').db;
  try {
    const path = '/api/admin/auth/csrf-token';
    await request(app).get(path).expect(403);
    const res = await request(app).get(path).set('X-Origin-Secret', process.env.ORIGIN_SECRET)
      .set('X-Forwarded-Proto', 'https').set('Origin', process.env.CORS_ORIGIN)
      .expect('Access-Control-Allow-Origin', process.env.CORS_ORIGIN).expect('Cache-Control', /no-store/).expect(200);
    const cookie = res.headers['set-cookie'][0];
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax']) assert.ok(cookie.includes(flag));
    assert.doesNotMatch(cookie, /Domain=/i);
  } finally { await prisma.$disconnect(); }
});
