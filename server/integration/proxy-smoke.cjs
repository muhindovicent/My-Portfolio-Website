// Run against a production-mode release on loopback and a disposable DB only.
const assert = require('node:assert/strict');
const port = Number(process.env.PORT);
async function main() {
  assert.ok(port > 0 && port <= 65535 && process.env.ORIGIN_SECRET);
  const base = `http://127.0.0.1:${port}`;
  const csrf = base + '/api/admin/auth/csrf-token';
  assert.equal((await fetch(base + '/health')).status, 200);
  assert.equal((await fetch(csrf)).status, 403);
  const headers = {'x-origin-secret': process.env.ORIGIN_SECRET, 'x-forwarded-proto':'https'};
  const response = await fetch(csrf, {headers});
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const cookie = response.headers.get('set-cookie');
  for (const attr of ['Secure','HttpOnly','SameSite=Lax']) assert.ok(cookie.includes(attr));
  assert.ok(!/;\s*domain=/i.test(cookie));
  const {csrfToken} = await response.json();
  headers.cookie = cookie.split(';')[0];
  assert.equal((await (await fetch(csrf,{headers})).json()).csrfToken, csrfToken);
  assert.equal((await fetch(base+'/api/admin/auth/login',{method:'POST',headers})).status,403);
  console.log('Production health, origin guard, secure host-only cookie persistence, no-store and CSRF checks passed');
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
