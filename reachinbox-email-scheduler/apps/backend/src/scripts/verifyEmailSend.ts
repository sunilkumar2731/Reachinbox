import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { EmailService } from '../services/emailService';
import { memoryStore } from '../services/memoryStore';

async function verifyEmailSend() {
  console.log('--- Email Scheduler End-to-End Test ---');
  
  // Retrieve or create test user
  const devUser = memoryStore.getOrCreateDevUser('freequoo@gmail.com', 'Test User');
  console.log(`User retrieved: ${devUser.email} (${devUser.id})`);

  const recipient = 'freequoo@gmail.com'; 
  const subject = 'ReachInbox Real Email Delivery Test ' + new Date().toLocaleTimeString();
  const body = 'Hello! This is a test email sent from ReachInbox Email Scheduler to verify real inbox delivery via Gmail SMTP.';

  console.log(`Scheduling email to ${recipient}...`);
  const result = await EmailService.scheduleEmails(devUser.id, {
    subject,
    body,
    recipients: [recipient],
    delayBetweenEmails: 0,
  });

  const emailId = result.emails[0]!.id;
  console.log(`Scheduled 1 email(s). Email ID: ${emailId}`);

  console.log('Waiting for background worker to process and deliver email...');
  
  // Poll memoryStore status until SENT or FAILED (max 15 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    await new Promise((res) => setTimeout(res, 1000));
    const email = await EmailService.getEmailById(devUser.id, emailId);
    console.log(`Current Email Status: ${email.status}`);
    if (email.status === 'SENT') {
      console.log(`\n🎉 SUCCESS! Email ${emailId} was successfully SENT to ${recipient} via Gmail SMTP!`);
      process.exit(0);
    }
    if (email.status === 'FAILED') {
      console.error(`\n❌ FAILED! Error: ${email.errorMessage}`);
      process.exit(1);
    }
  }

  console.error('Timed out waiting for email to complete.');
  process.exit(1);
}

verifyEmailSend().catch((err) => {
  console.error('Fatal Error during verification:', err);
  process.exit(1);
});
