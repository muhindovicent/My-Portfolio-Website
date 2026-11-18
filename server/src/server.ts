import app from './app.ts.ts';
import { getEnv } from './config/env.ts.ts';

const env = getEnv();
const port = env.PORT;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Portfolio API listening on http://localhost:${port} (${env.NODE_ENV})`);
});

export default server;


