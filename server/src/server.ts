import app from './app';
import { getEnv } from './config/env';

const env = getEnv();
const port = env.PORT;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Portfolio API listening on http://localhost:${port} (${env.NODE_ENV})`);
});

export default server;
