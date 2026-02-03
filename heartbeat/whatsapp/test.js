/**
 * Test script for debugging Telegram bot messaging
 *
 * Usage: node test.js
 *
 * Loads .env and attempts to send a test message to verify credentials.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const TelegramBot = require('node-telegram-bot-api');

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_TELEGRAM_CHAT_ID = process.env.MY_TELEGRAM_CHAT_ID;

console.log('=== Telegram Configuration Debug ===\n');

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

// Validate TELEGRAM_BOT_TOKEN
if (!TELEGRAM_BOT_TOKEN) {
  console.log('TELEGRAM_BOT_TOKEN: NOT SET');
} else if (TELEGRAM_BOT_TOKEN.includes('1234567890') || TELEGRAM_BOT_TOKEN === '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz') {
  console.log('TELEGRAM_BOT_TOKEN: PLACEHOLDER (update with real value)');
} else if (!TELEGRAM_BOT_TOKEN.includes(':')) {
  console.log('TELEGRAM_BOT_TOKEN: INVALID FORMAT (should contain ":")');
} else {
  console.log(`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...${TELEGRAM_BOT_TOKEN.slice(-4)} (looks valid)`);
}

// Validate MY_TELEGRAM_CHAT_ID
if (!MY_TELEGRAM_CHAT_ID) {
  console.log('MY_TELEGRAM_CHAT_ID: NOT SET');
} else if (MY_TELEGRAM_CHAT_ID === '123456789') {
  console.log('MY_TELEGRAM_CHAT_ID: PLACEHOLDER (update with real value)');
} else {
  console.log(`MY_TELEGRAM_CHAT_ID: ${MY_TELEGRAM_CHAT_ID}`);
}

if (!MY_TELEGRAM_CHAT_ID || MY_TELEGRAM_CHAT_ID === '123456789') {
  console.log('\nWARNING: MY_TELEGRAM_CHAT_ID not configured - cannot send test message');
  console.log('To get your chat ID:');
  console.log('1. Start a chat with your bot');
  console.log('2. Send any message to it');
  console.log(`3. Run: curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
  console.log('4. Find your chat.id in the response');
  process.exit(1);
}

console.log('');
console.log('=== Creating Telegram Bot ===\n');

let bot = null;
try {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  console.log('Telegram bot created successfully');
} catch (error) {
  console.log('Failed to create Telegram bot:', error.message);
  process.exit(1);
}

console.log('');
console.log('=== Sending Test Message ===\n');

async function sendTestMessage() {
  const testMessage = `Test message from Orko Telegram bot\n\nTimestamp: ${new Date().toISOString()}\n\nIf you see this, Telegram is configured correctly!`;

  console.log(`Chat ID: ${MY_TELEGRAM_CHAT_ID}`);
  console.log(`Message: ${testMessage.substring(0, 50)}...`);
  console.log('');

  try {
    console.log('Calling bot.sendMessage()...');
    const message = await bot.sendMessage(MY_TELEGRAM_CHAT_ID, testMessage);

    console.log('');
    console.log('=== SUCCESS ===');
    console.log('');
    console.log('Message ID:', message.message_id);
    console.log('Chat ID:', message.chat.id);
    console.log('');
    console.log('Check your Telegram for the test message!');

  } catch (error) {
    console.log('');
    console.log('=== ERROR ===');
    console.log('');
    console.log('Error name:', error.name);
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);

    console.log('');
    console.log('=== Troubleshooting ===');
    console.log('');

    if (error.code === 'ETELEGRAM') {
      if (error.message.includes('401')) {
        console.log('Authentication failed. Check:');
        console.log('1. TELEGRAM_BOT_TOKEN is correct');
        console.log('2. Token was copied completely (no missing characters)');
        console.log('3. Bot has not been revoked in @BotFather');
      } else if (error.message.includes('400') && error.message.includes('chat not found')) {
        console.log('Chat not found. Check:');
        console.log('1. MY_TELEGRAM_CHAT_ID is correct');
        console.log('2. You have started a chat with the bot (send /start)');
        console.log('3. The chat ID is numeric (not a username)');
      } else if (error.message.includes('403')) {
        console.log('Bot was blocked by user or cannot access chat.');
        console.log('1. Make sure you have not blocked the bot');
        console.log('2. Send a message to the bot to reactivate');
      }
    }

    process.exit(1);
  }
}

sendTestMessage();
