import os from 'os';
import { env, payhereEnabled } from './config/env';
import { createApp } from './app';
import { startJobs } from './jobs';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`\nSerendibGO API running`);
  console.log(`  Local:    http://localhost:${env.PORT}`);
  if (lan) console.log(`  Network:  http://${lan}:${env.PORT}   <- use this address in the mobile app (.env EXPO_PUBLIC_API_URL)`);
  console.log(`  API docs: http://localhost:${env.PORT}/api/docs`);
  console.log(`  Payments: ${payhereEnabled ? 'PayHere sandbox' : 'built-in simulator (set PAYHERE_* to use PayHere)'}\n`);
  startJobs();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
