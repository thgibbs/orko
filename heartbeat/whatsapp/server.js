/**
 * Orko Telegram Bot
 *
 * Receives Telegram messages, adds actions to heartbeat.md,
 * and sends responses back when Orko processes them.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_TELEGRAM_CHAT_ID = process.env.MY_TELEGRAM_CHAT_ID;

// Debug: Print Telegram credentials for verification (redacted for security)
console.log('[DEBUG] TELEGRAM_BOT_TOKEN:', TELEGRAM_BOT_TOKEN ? `${TELEGRAM_BOT_TOKEN.substring(0, 10)}...${TELEGRAM_BOT_TOKEN.substring(TELEGRAM_BOT_TOKEN.length - 4)}` : 'NOT SET');
console.log('[DEBUG] MY_TELEGRAM_CHAT_ID:', MY_TELEGRAM_CHAT_ID || 'NOT SET');
console.log('[DEBUG] .env file loaded from:', require('path').join(__dirname, '..', '.env'));

// File paths
const HEARTBEAT_PATH = path.join(__dirname, '..', 'heartbeat.md');
const RESPONSES_PATH = path.join(__dirname, 'responses.json');

// Telegram bot instance
let bot = null;
console.log('[DEBUG] Initializing Telegram bot...');

if (TELEGRAM_BOT_TOKEN) {
  // Warn if token looks like placeholder
  if (TELEGRAM_BOT_TOKEN.includes('1234567890') || TELEGRAM_BOT_TOKEN === '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz') {
    console.warn('[WARNING] Telegram token appears to be a placeholder value from .env.example');
    console.warn('[WARNING] Update TELEGRAM_BOT_TOKEN in heartbeat/.env with your real bot token');
  }

  // Validate token format (should contain a colon)
  if (!TELEGRAM_BOT_TOKEN.includes(':')) {
    console.warn('[WARNING] TELEGRAM_BOT_TOKEN format looks invalid (should contain ":")');
  }

  try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('[DEBUG] Telegram bot created successfully with polling enabled');
  } catch (error) {
    console.error('[ERROR] Failed to create Telegram bot:', error.message);
  }
} else {
  console.warn('[WARNING] Telegram credentials not configured. Create heartbeat/.env from .env.example');
}

/**
 * Redact PII from text for logging
 */
function redactPII(text) {
  if (!text) return text;
  // Redact phone numbers
  let redacted = text.replace(/\+?\d{10,15}/g, '[PHONE]');
  // Redact email addresses
  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  return redacted;
}

/**
 * Log with timestamp and PII redaction
 */
function log(message, data = null, options = {}) {
  const { redact = true } = options;
  const timestamp = new Date().toISOString();
  const outputMessage = redact ? redactPII(message) : message;
  console.log(`[${timestamp}] ${outputMessage}`);
  if (data) {
    console.log(JSON.stringify(data, (key, value) => {
      if (typeof value === 'string' && redact) return redactPII(value);
      return value;
    }, 2));
  }
}

/**
 * Parse Telegram command from message text
 */
function parseCommand(text) {
  const trimmed = text.trim();

  // Command patterns
  if (trimmed.startsWith('/task ')) {
    return { command: 'task', args: trimmed.slice(6).trim() };
  }
  if (trimmed === '/status') {
    return { command: 'status', args: null };
  }
  if (trimmed === '/list') {
    return { command: 'list', args: null };
  }
  if (trimmed === '/help' || trimmed === '/start') {
    return { command: 'help', args: null };
  }

  // Default: treat entire message as a task
  return { command: 'task', args: trimmed };
}

/**
 * Generate a unique action ID
 */
function generateActionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `tg-${timestamp}-${random}`;
}

/**
 * Add an action to heartbeat.md
 */
function addActionToHeartbeat(taskDescription, messageId, chatId) {
  try {
    let content = fs.readFileSync(HEARTBEAT_PATH, 'utf8');

    const actionId = generateActionId();
    const timestamp = new Date().toISOString();

    // Create new action block
    const newAction = `
### [MEDIUM] Telegram Task - ${taskDescription.substring(0, 50)}${taskDescription.length > 50 ? '...' : ''}
- **id**: ${actionId}
- **type**: telegram-reply
- **task**: ${taskDescription}
- **reply_to**: ${messageId}
- **chat_id**: ${chatId}
- **received_at**: ${timestamp}
- **status**: PENDING
`;

    // Find the "## Pending Actions" section and add after it
    const pendingMatch = content.match(/## Pending Actions\n/);
    if (pendingMatch) {
      const insertPos = pendingMatch.index + pendingMatch[0].length;
      content = content.slice(0, insertPos) + newAction + content.slice(insertPos);
    } else {
      // Fallback: append to end
      content += '\n' + newAction;
    }

    fs.writeFileSync(HEARTBEAT_PATH, content);
    log(`Added action ${actionId} to heartbeat.md`);
    return actionId;
  } catch (error) {
    log(`Error adding action to heartbeat: ${error.message}`);
    throw error;
  }
}

/**
 * Get immediate response for simple commands
 */
function getImmediateResponse(command) {
  switch (command) {
    case 'help':
      return `*Orko Telegram Commands*

/task <description> - Add a new task for Orko
/status - Check Orko's current status
/list - List pending actions
/help - Show this help message

Or just send any message and I'll treat it as a task!`;

    case 'status':
      try {
        const content = fs.readFileSync(HEARTBEAT_PATH, 'utf8');
        const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const lastWake = frontmatterMatch[1].match(/last_wake:\s*(.+)/);
          const status = frontmatterMatch[1].match(/status:\s*(.+)/);
          return `*Orko Status*
Last wake: ${lastWake ? lastWake[1] : 'Never'}
Status: ${status ? status[1] : 'Unknown'}`;
        }
        return 'Unable to read status';
      } catch {
        return 'Error reading status';
      }

    case 'list':
      try {
        const content = fs.readFileSync(HEARTBEAT_PATH, 'utf8');
        const pendingMatch = content.match(/## Pending Actions\n([\s\S]*?)(?=\n## |$)/);
        if (pendingMatch) {
          const actions = pendingMatch[1].match(/### \[.*?\] .+/g) || [];
          if (actions.length === 0) {
            return 'No pending actions';
          }
          return `*Pending Actions (${actions.length})*\n${actions.slice(0, 5).join('\n')}${actions.length > 5 ? `\n...and ${actions.length - 5} more` : ''}`;
        }
        return 'No pending actions';
      } catch {
        return 'Error reading actions';
      }

    default:
      return null;
  }
}

/**
 * Send Telegram message
 */
async function sendTelegramMessage(chatId, text) {
  log('[sendTelegramMessage] Called');
  log(`[sendTelegramMessage] bot exists: ${!!bot}`);

  if (!bot) {
    log('[sendTelegramMessage] Telegram bot not configured, cannot send message');
    return false;
  }

  log(`[sendTelegramMessage] Preparing to send message`);
  log(`[sendTelegramMessage] Chat ID: ${chatId}`);
  log(`[sendTelegramMessage] Text length: ${text?.length || 0} chars`);

  try {
    log('[sendTelegramMessage] Calling bot.sendMessage()...');
    const message = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    log(`[sendTelegramMessage] Success! Message ID: ${message.message_id}`);
    return true;
  } catch (error) {
    log(`[sendTelegramMessage] Error caught!`);
    log(`[sendTelegramMessage] Error name: ${error.name}`);
    log(`[sendTelegramMessage] Error code: ${error.code}`);
    log(`[sendTelegramMessage] Error message: ${error.message}`);

    // Retry without markdown if parsing failed
    if (error.message && error.message.includes("can't parse")) {
      try {
        log('[sendTelegramMessage] Retrying without Markdown...');
        const message = await bot.sendMessage(chatId, text);
        log(`[sendTelegramMessage] Success on retry! Message ID: ${message.message_id}`);
        return true;
      } catch (retryError) {
        log(`[sendTelegramMessage] Retry also failed: ${retryError.message}`);
      }
    }
    return false;
  }
}

/**
 * Check if sender is authorized
 */
function isAuthorizedSender(chatId) {
  if (!MY_TELEGRAM_CHAT_ID) return true; // No restriction if not configured
  return String(chatId) === String(MY_TELEGRAM_CHAT_ID);
}

// Set up message handler
if (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const messageId = msg.message_id;

    log(`Received message from chat ${chatId}`);

    // Check authorization
    if (!isAuthorizedSender(chatId)) {
      log(`Unauthorized sender: ${chatId}`);
      await sendTelegramMessage(chatId, 'Unauthorized. This bot only responds to its owner.');
      return;
    }

    if (!text) {
      log('Message has no text, ignoring');
      return;
    }

    log(`Message text: ${redactPII(text)}`);

    const { command, args } = parseCommand(text);

    // Handle immediate response commands
    const immediateResponse = getImmediateResponse(command);
    if (immediateResponse && command !== 'task') {
      await sendTelegramMessage(chatId, immediateResponse);
      return;
    }

    // For tasks, add to heartbeat.md
    if (command === 'task' && args) {
      try {
        const actionId = addActionToHeartbeat(args, messageId, chatId);
        await sendTelegramMessage(chatId, `Got it! Task added as \`${actionId}\`. I'll work on it soon!`);
      } catch (error) {
        await sendTelegramMessage(chatId, `Oops! Had trouble adding that task: ${error.message}`);
      }
    }
  });

  bot.on('polling_error', (error) => {
    log(`[Polling Error] ${error.code}: ${error.message}`);
  });

  log('Telegram bot is listening for messages...');
}

/**
 * Watch responses.json and send pending responses
 */
function watchResponses() {
  const watcher = chokidar.watch(RESPONSES_PATH, {
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('change', async () => {
    log('responses.json changed, checking for pending responses');

    try {
      const content = fs.readFileSync(RESPONSES_PATH, 'utf8');
      const data = JSON.parse(content);

      if (data.pending && data.pending.length > 0) {
        for (const response of data.pending) {
          // Support both 'to' (legacy) and 'chat_id' (new)
          const chatId = response.chat_id || response.to || MY_TELEGRAM_CHAT_ID;
          if (chatId) {
            await sendTelegramMessage(chatId, response.message);
          } else {
            log(`WARNING: Cannot send response for action ${response.action_id} - no chat_id. Response must include 'chat_id' field or MY_TELEGRAM_CHAT_ID must be set in .env`);
          }
        }

        // Clear pending responses
        fs.writeFileSync(RESPONSES_PATH, JSON.stringify({ pending: [] }, null, 2));
        log('Cleared pending responses');
      }
    } catch (error) {
      log(`Error processing responses: ${error.message}`);
    }
  });

  log('Watching responses.json for changes');
}

// Start watching for responses
if (bot) {
  watchResponses();
  log('Orko Telegram bot is running!');
  log(`Bot configured: ${!!bot}`);
} else {
  log('Bot not configured - check your .env file');
}

// Keep the process running
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  if (bot) {
    bot.stopPolling();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  if (bot) {
    bot.stopPolling();
  }
  process.exit(0);
});
