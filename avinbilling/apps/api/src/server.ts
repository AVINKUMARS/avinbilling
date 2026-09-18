import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function start() {
  await connectDatabase();
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Avin API listening on http://0.0.0.0:${env.PORT}`);
  });
}

start().catch((error) => {
  console.error('API startup failed', error);
  process.exit(1);
});
