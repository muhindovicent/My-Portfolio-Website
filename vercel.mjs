// Portfolio Studio + API are served by the Render origin; the public portfolio
// stays on Vercel's static output. No upstream configured: static site only.
const origin = process.env.VERCEL_ENV === 'preview' ? undefined : process.env.RENDER_API_ORIGIN;
if (origin && !/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) {
  throw new Error('RENDER_API_ORIGIN must be the exact HTTPS Render service origin');
}

const proxy = (src) => ({
  src,
  dest: `${origin}${src.replace('(.*)', '$1')}`,
  // Vercel substitutes the deployment secret server-side and replaces any client value.
  transforms: [
    {
      type: 'request.headers',
      op: 'set',
      target: { key: 'x-origin-secret' },
      args: '$ORIGIN_SECRET',
      env: ['ORIGIN_SECRET'],
    },
  ],
});

// Every project URL renders the same shell; it fetches the published project by slug.
// The negative lookahead leaves the shell file itself untouched.
const projectShell = {
  src: '/work/((?!_project(?:/|$))[^/]+)/?',
  dest: '/work/_project/index.html',
};

const routes = [projectShell];
if (origin) routes.push(proxy('/api/(.*)'), proxy('/admin'), proxy('/admin/(.*)'));

export const config = {
  framework: null,
  outputDirectory: 'dist',
  routes,
};
