import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { AuthService } from '../services/authService';

async function testAuthFlow() {
  console.log('--- Auth Flow Verification Test ---');

  const testEmail = `user_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Test User';

  // 1. Register new user
  console.log(`1. Registering user: ${testEmail}...`);
  const registeredUser = await AuthService.registerUser(testEmail, testPassword, testName);
  console.log(`✅ Registered user ID: ${registeredUser.id}, Email: ${registeredUser.email}`);

  // 2. Authenticate user with correct password
  console.log('2. Authenticating with correct password...');
  const loggedInUser = await AuthService.loginUser(testEmail, testPassword);
  console.log(`✅ Login successful for ID: ${loggedInUser.id}`);

  // 3. Test invalid password
  console.log('3. Testing invalid password failure...');
  try {
    await AuthService.loginUser(testEmail, 'WrongPassword!');
    console.error('❌ Should have failed with invalid password!');
    process.exit(1);
  } catch (err: any) {
    console.log(`✅ Correctly rejected invalid password: ${err.message}`);
  }

  // 4. Test Google OAuth linking with same email
  console.log('4. Testing Google OAuth linking for existing email account...');
  const googleId = `google_sub_${Date.now()}`;
  const linkedUser = await AuthService.findOrCreateGoogleUser(
    googleId,
    testEmail,
    'Updated Google Name',
    'https://lh3.googleusercontent.com/a/default-user-photo'
  );

  console.log(`✅ Google user linked successfully: User ID: ${linkedUser.id}, Google ID: ${linkedUser.googleId}`);
  if (linkedUser.id === registeredUser.id) {
    console.log('🎉 SUCCESS! Account linked to existing user without creating a duplicate!');
  } else {
    console.error('❌ Duplicate user created!');
    process.exit(1);
  }

  console.log('\n--- All Auth Flow Tests Passed Cleanly! ---');
  process.exit(0);
}

testAuthFlow().catch((err) => {
  console.error('Fatal error during auth test:', err);
  process.exit(1);
});
