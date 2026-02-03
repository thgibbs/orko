/**
 * Test script for debugging Twilio WhatsApp messaging
 *
 * Usage: node test.js
 *
 * Loads .env and attempts to send a test message to verify credentials.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const twilio = require('twilio');

// Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const MY_WHATSAPP_NUMBER = process.env.MY_WHATSAPP_NUMBER;

console.log('=== Twilio Configuration Debug ===\n');

console.log('.env path:', require('path').join(__dirname, '..', '.env'));
console.log('');

// Check if .env file exists
const fs = require('fs');
const envPath = require('path').join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('.env file: EXISTS');
} else {
  console.log('.env file: NOT FOUND');
  console.log('Create heartbeat/.env from .env.example and add your credentials');
  process.exit(1);
}

console.log('');
console.log('=== Credentials ===\n');

// Validate TWILIO_ACCOUNT_SID
if (!TWILIO_ACCOUNT_SID) {
  console.log('TWILIO_ACCOUNT_SID: NOT SET');
} else if (TWILIO_ACCOUNT_SID.includes('xxxx')) {
  console.log('TWILIO_ACCOUNT_SID: PLACEHOLDER (update with real value)');
} else if (!TWILIO_ACCOUNT_SID.startsWith('AC')) {
  console.log(`TWILIO_ACCOUNT_SID: INVALID FORMAT (should start with "AC", got "${TWILIO_ACCOUNT_SID.substring(0, 2)}")`);
} else {
  console.log(`TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID.substring(0, 8)}...${TWILIO_ACCOUNT_SID.slice(-4)} (looks valid)`);
}

// Validate TWILIO_AUTH_TOKEN
if (!TWILIO_AUTH_TOKEN) {
  console.log('TWILIO_AUTH_TOKEN: NOT SET');
} else if (TWILIO_AUTH_TOKEN.includes('xxxx')) {
  console.log('TWILIO_AUTH_TOKEN: PLACEHOLDER (update with real value)');
} else {
  console.log(`TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN.substring(0, 4)}...${TWILIO_AUTH_TOKEN.slice(-4)} (length: ${TWILIO_AUTH_TOKEN.length})`);
}

// Validate phone numbers
console.log('');
console.log('TWILIO_WHATSAPP_NUMBER:', TWILIO_WHATSAPP_NUMBER || 'NOT SET');
console.log('MY_WHATSAPP_NUMBER:', MY_WHATSAPP_NUMBER || 'NOT SET');

if (!MY_WHATSAPP_NUMBER || MY_WHATSAPP_NUMBER.includes('XXXXXXXXXX')) {
  console.log('\nWARNING: MY_WHATSAPP_NUMBER not configured - cannot send test message');
  console.log('Update MY_WHATSAPP_NUMBER in heartbeat/.env with your WhatsApp number');
  process.exit(1);
}

console.log('');
console.log('=== Creating Twilio Client ===\n');

let twilioClient = null;
try {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('Twilio client created successfully');
} catch (error) {
  console.log('Failed to create Twilio client:', error.message);
  process.exit(1);
}

console.log('');
console.log('=== Sending Test Message ===\n');

async function sendTestMessage() {
  const testMessage = `🧪 Test message from Orko WhatsApp server\n\nTimestamp: ${new Date().toISOString()}\n\nIf you see this, Twilio is configured correctly!`;

  console.log(`From: ${TWILIO_WHATSAPP_NUMBER}`);
  console.log(`To: ${MY_WHATSAPP_NUMBER}`);
  console.log(`Message: ${testMessage.substring(0, 50)}...`);
  console.log('');

  try {
    console.log('Calling twilioClient.messages.create()...');
    const message = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: MY_WHATSAPP_NUMBER,
      body: testMessage
    });

    console.log('');
    console.log('=== SUCCESS ===');
    console.log('');
    console.log('Message SID:', message.sid);
    console.log('Status:', message.status);
    console.log('');
    console.log('Check your WhatsApp for the test message!');

  } catch (error) {
    console.log('');
    console.log('=== ERROR ===');
    console.log('');
    console.log('Error name:', error.name);
    console.log('Error code:', error.code);
    console.log('Error status:', error.status);
    console.log('Error message:', error.message);

    if (error.moreInfo) {
      console.log('More info:', error.moreInfo);
    }

    console.log('');
    console.log('=== Troubleshooting ===');
    console.log('');

    if (error.code === 20003 || error.message === 'Authenticate') {
      console.log('Authentication failed. Check:');
      console.log('1. TWILIO_ACCOUNT_SID is correct (starts with AC)');
      console.log('2. TWILIO_AUTH_TOKEN is correct (from Twilio Console)');
      console.log('3. Credentials are for the correct account');
    } else if (error.code === 21608) {
      console.log('The "from" number is not a valid WhatsApp-enabled number.');
      console.log('Check TWILIO_WHATSAPP_NUMBER in your .env');
    } else if (error.code === 21211) {
      console.log('Invalid "to" phone number format.');
      console.log('MY_WHATSAPP_NUMBER should be: whatsapp:+1XXXXXXXXXX');
    } else if (error.code === 63007) {
      console.log('WhatsApp sandbox not joined or 24-hour window expired.');
      console.log('1. Text "join <sandbox-word>" to your Twilio sandbox number');
      console.log('2. Or upgrade to a production WhatsApp number');
    }

    process.exit(1);
  }
}

sendTestMessage();
