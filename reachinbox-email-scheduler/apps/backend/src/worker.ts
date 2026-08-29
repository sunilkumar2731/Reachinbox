import { startEmailWorker } from './queues/emailWorker';
import { prisma } from './config/prisma';

console.log('🚀 Starting ReachInbox Email Worker Process...');

const worker = startEmailWorker();

const shutdown = async (signal: string) => {
  console.log(`[Worker] Received ${signal}. Gracefully closing worker and database connections...`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
