/**
 * Orko WhatsApp Webhook Server
 *
 * Receives WhatsApp messages via Twilio, adds actions to heartbeat.md,
 * and sends responses back when Orko processes them.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();

// Trust proxy headers (needed for ngrok/reverse proxy to correctly identify HTTPS)
// This makes req.protocol use X-Forwarded-Proto header
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuration
const PORT = process.env.WEBHOOK_PORT || 3000;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const MY_WHATSAPP_NUMBER = process.env.MY_WHATSAPP_NUMBER;
const VALIDATE_SIGNATURE = process.env.VALIDATE_TWILIO_SIGNATURE !== 'false';

// Debug: Print Twilio credentials for verification (redacted for security)
console.log('[DEBUG] TWILIO_ACCOUNT_SID:', TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 8)}...${TWILIO_ACCOUNT_SID.substring(TWILIO_ACCOUNT_SID.length - 4)}` : 'NOT SET');
console.log('[DEBUG] TWILIO_AUTH_TOKEN:', TWILIO_AUTH_TOKEN ? `${TWILIO_AUTH_TOKEN.substring(0, 4)}...${TWILIO_AUTH_TOKEN.substring(TWILIO_AUTH_TOKEN.length - 4)} (length: ${TWILIO_AUTH_TOKEN.length})` : 'NOT SET');
console.log('[DEBUG] TWILIO_WHATSAPP_NUMBER:', TWILIO_WHATSAPP_NUMBER || 'NOT SET');
console.log('[DEBUG] .env file loaded from:', require('path').join(__dirname, '..', '.env'));

// File paths
const HEARTBEAT_PATH = path.join(__dirname, '..', 'heartbeat.md');
const RESPONSES_PATH = path.join(__dirname, 'responses.json');

// Twilio client for sending messages
let twilioClient = null;
console.log('[DEBUG] Initializing Twilio client...');
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  // Warn if credentials look like placeholders
  if (TWILIO_ACCOUNT_SID.includes('xxxx') || TWILIO_AUTH_TOKEN.includes('xxxx')) {
    console.warn('[WARNING] Twilio credentials appear to be placeholder values from .env.example');
    console.warn('[WARNING] Update TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in heartbeat/.env with real credentials');
  }

  // Validate credential format
  if (!TWILIO_ACCOUNT_SID.startsWith('AC')) {
    console.warn('[WARNING] TWILIO_ACCOUNT_SID should start with "AC". Current value starts with:', TWILIO_ACCOUNT_SID.substring(0, 2));
  }

  console.log('[DEBUG] Creating Twilio client with SID:', TWILIO_ACCOUNT_SID.substring(0, 8) + '...');
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('[DEBUG] Twilio client created successfully');
  } catch (error) {
    console.error('[ERROR] Failed to create Twilio client:', error.message);
  }
} else {
  console.warn('[WARNING] Twilio credentials not configured. Create heartbeat/.env from .env.example');
  console.warn('[DEBUG] TWILIO_ACCOUNT_SID is:', TWILIO_ACCOUNT_SID ? 'set' : 'NOT SET');
  console.warn('[DEBUG] TWILIO_AUTH_TOKEN is:', TWILIO_AUTH_TOKEN ? 'set' : 'NOT SET');
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
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const redactedMessage = redactPII(message);
  console.log(`[${timestamp}] ${redactedMessage}`);
  if (data) {
    console.log(JSON.stringify(data, (key, value) => {
      if (typeof value === 'string') return redactPII(value);
      return value;
    }, 2));
  }
}

/**
 * Parse WhatsApp command from message body
 */
function parseCommand(body) {
  const trimmed = body.trim();

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
  if (trimmed === '/help') {
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
  return `wa-${timestamp}-${random}`;
}

/**
 * Add an action to heartbeat.md
 */
function addActionToHeartbeat(taskDescription, messageId, senderNumber) {
  try {
    let content = fs.readFileSync(HEARTBEAT_PATH, 'utf8');

    const actionId = generateActionId();
    const timestamp = new Date().toISOString();

    // Create new action block
    const newAction = `
### [MEDIUM] WhatsApp Task - ${taskDescription.substring(0, 50)}${taskDescription.length > 50 ? '...' : ''}
- **id**: ${actionId}
- **type**: whatsapp-reply
- **task**: ${taskDescription}
- **reply_to**: ${messageId}
- **from**: ${senderNumber}
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
      return `*Orko WhatsApp Commands*

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
 * Send WhatsApp message via Twilio
 */
async function sendWhatsAppMessage(to, body) {
  log('[sendWhatsAppMessage] Called');
  log(`[sendWhatsAppMessage] twilioClient exists: ${!!twilioClient}`);

  if (!twilioClient) {
    log('[sendWhatsAppMessage] Twilio client not configured, cannot send message');
    return false;
  }

  log(`[sendWhatsAppMessage] Preparing to send message`);
  log(`[sendWhatsAppMessage] From: ${TWILIO_WHATSAPP_NUMBER}`);
  log(`[sendWhatsAppMessage] To: ${redactPII(to)}`);
  log(`[sendWhatsAppMessage] Body length: ${body?.length || 0} chars`);

  try {
    log('[sendWhatsAppMessage] Calling twilioClient.messages.create()...');
    const message = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: to,
      body: body
    });
    log(`[sendWhatsAppMessage] Success! Message SID: ${message.sid}`);
    log(`[sendWhatsAppMessage] Message status: ${message.status}`);
    return true;
  } catch (error) {
    log(`[sendWhatsAppMessage] Error caught!`);
    log(`[sendWhatsAppMessage] Error name: ${error.name}`);
    log(`[sendWhatsAppMessage] Error code: ${error.code}`);
    log(`[sendWhatsAppMessage] Error status: ${error.status}`);
    log(`[sendWhatsAppMessage] Error message: ${error.message}`);
    log(`[sendWhatsAppMessage] Error details: ${JSON.stringify(error.details || {})}`);
    log(`[sendWhatsAppMessage] Error moreInfo: ${error.moreInfo || 'N/A'}`);

    if (error.code === 20003 || error.message === 'Authenticate') {
      log('[sendWhatsAppMessage] Authentication failure detected (code 20003 or Authenticate message)');
      log('[sendWhatsAppMessage] This usually means TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is incorrect');
      log(`[sendWhatsAppMessage] Current SID starts with: ${TWILIO_ACCOUNT_SID?.substring(0, 8) || 'NOT SET'}`);
      log(`[sendWhatsAppMessage] Current Token length: ${TWILIO_AUTH_TOKEN?.length || 0}`);
    }
    return false;
  }
}

/**
 * Validate Twilio webhook signature
 */
function validateTwilioSignature(req) {
  if (!VALIDATE_SIGNATURE) return true;
  if (!TWILIO_AUTH_TOKEN) return true;

  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, req.body);
}

/**
 * Check if sender is authorized
 */
function isAuthorizedSender(from) {
  if (!MY_WHATSAPP_NUMBER) return true; // No restriction if not configured
  return from === MY_WHATSAPP_NUMBER;
}

// Webhook endpoint - receives incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  log('Received webhook POST');

  // Validate Twilio signature
  if (!validateTwilioSignature(req)) {
    log('Invalid Twilio signature');
    return res.status(403).send('Forbidden');
  }

  const { From, Body, MessageSid } = req.body;

  // Check authorization
  if (!isAuthorizedSender(From)) {
    log('Unauthorized sender');
    return res.status(403).send('Unauthorized');
  }

  log(`Message from [SENDER]: ${redactPII(Body)}`);

  const { command, args } = parseCommand(Body);

  // Handle immediate response commands
  const immediateResponse = getImmediateResponse(command);
  if (immediateResponse && command !== 'task') {
    await sendWhatsAppMessage(From, immediateResponse);
    return res.status(200).send('OK');
  }

  // For tasks, add to heartbeat.md
  if (command === 'task' && args) {
    try {
      const actionId = addActionToHeartbeat(args, MessageSid, From);
      await sendWhatsAppMessage(From, `Got it! Task added as ${actionId}. I'll work on it soon!`);
    } catch (error) {
      await sendWhatsAppMessage(From, `Oops! Had trouble adding that task: ${error.message}`);
    }
  }

  res.status(200).send('OK');
});

// Twilio webhook verification (GET request)
app.get('/webhook', (req, res) => {
  log('Received webhook GET (verification)');
  res.status(200).send('Webhook is active');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    twilioConfigured: !!twilioClient
  });
});

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
          const to = response.to || MY_WHATSAPP_NUMBER;
          if (to) {
            await sendWhatsAppMessage(to, response.message);
          } else {
            log(`WARNING: Cannot send response for action ${response.action_id} - no recipient. Response must include 'to' field or MY_WHATSAPP_NUMBER must be set in .env`);
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

// Start server
app.listen(PORT, () => {
  log(`Orko WhatsApp webhook server running on port ${PORT}`);
  log(`Twilio configured: ${!!twilioClient}`);
  log(`Signature validation: ${VALIDATE_SIGNATURE ? 'enabled' : 'disabled'}`);

  // Start watching for responses
  watchResponses();
});
