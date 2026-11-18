// No upstream configured: serve only the checked-in static portfolio.
const origin = process.env.RENDER_API_ORIGIN;
if (origin && !/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)) {
  throw new Error('RENDER_API_ORIGIN must be the exact HTTPS Render service origin');
}
export const config = {
  framework: null,
  outputDirectory: 'dist',
  routes: origin ? [{
    src: '/api/(.*)', dest: `${origin}/api/$1`,
    // Vercel substitutes the deployment secret server-side and replaces any client value.
    transforms: [{type:'request.headers', op:'set', target:{key:'x-origin-secret'},
      args:'$ORIGIN_SECRET', env:['ORIGIN_SECRET']}],
  }] : [],
};
