/**
 * Load Test Script — Schedule 1,000+ emails in BullMQ
 * 
 * Demonstrates:
 * 1. Fast batch generation of 1,000 recipients
 * 2. Delay calculation & BullMQ delayed job enqueueing
 * 3. PostgreSQL batch creation
 * 4. Queue backpressure and Redis persistence
 * 5. Configured far in the future (or dry-run mode) so it doesn't flood Ethereal test servers
 */

import { EmailService } from '../services/emailService';
import { prisma } from '../config/prisma';
import { emailQueue } from '../queues/emailQueue';

async function runLoadTest() {
  console.log('====================================================');
  console.log('🚀 Starting 1,000 Email Scheduling Load Test');
  console.log('====================================================\n');

  // 1. Get or create test user
  const user = await prisma.user.upsert({
    where: { email: 'loadtest@reachinbox.ai' },
    update: {},
    create: {
      googleId: 'dev_loadtest_1000',
      email: 'loadtest@reachinbox.ai',
      name: 'Load Test Runner',
    },
  });

  console.log(`👤 Using user: ${user.name} (${user.id})`);

  // 2. Generate 1,000 unique mock email leads
  const COUNT = 1000;
  console.log(`📦 Generating ${COUNT} unique recipient email leads...`);

  const recipients: string[] = [];
  for (let i = 1; i <= COUNT; i++) {
    recipients.push(`candidate_${i.toString().padStart(4, '0')}@techcompany-eval.io`);
  }

  // Schedule for 2 hours in the future to allow queue inspection in Bull Board without immediately sending
  const futureStartTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  console.log(`⏱️  Scheduling start time: ${futureStartTime}`);
  console.log(`⏳ Delay between emails: 1,000 ms (1s)`);
  console.log(`🛑 Hourly limit: 250 emails/hr\n`);

  const startTime = Date.now();

  const result = await EmailService.scheduleEmails(user.id, {
    subject: 'Senior Full-Stack Engineer Opportunity — ReachInbox',
    body: 'Hello candidate, we reviewed your profile and would love to connect about our technical team roles.',
    recipients,
    startTime: futureStartTime,
    delayBetweenEmails: 1000,
    hourlyLimit: 250,
  });

  const durationMs = Date.now() - startTime;

  console.log('====================================================');
  console.log(`✅ LOAD TEST COMPLETE`);
  console.log(`• Successfully Scheduled: ${result.scheduledCount} emails`);
  console.log(`• Invalid Emails: ${result.invalidEmails.length}`);
  console.log(`• Total Execution Time: ${durationMs} ms (${(durationMs / 1000).toFixed(2)}s)`);
  console.log(`• Throughput: ${(COUNT / (durationMs / 1000)).toFixed(0)} emails scheduled/sec`);
  console.log('====================================================\n');

  // 3. Inspect BullMQ queue counts
  const jobCounts = await emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed', 'failed');
  console.log('📊 Current BullMQ Queue Counts:');
  console.log(JSON.stringify(jobCounts, null, 2));

  console.log('\n💡 You can now view all 1,000 delayed jobs at http://localhost:4000/admin/queues');

  await prisma.$disconnect();
  process.exit(0);
}

runLoadTest().catch(async (err) => {
  console.error('💥 Load test failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
