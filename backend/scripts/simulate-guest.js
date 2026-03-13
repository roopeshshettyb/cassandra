/**
 * Simulated Guest — end-to-end smoke test for the /chat WebSocket gateway.
 *
 * Usage:
 *   node scripts/simulate-guest.js --token <JWT> --bookingId <id> [options]
 *
 * Options:
 *   --token      JWT token for authentication (required)
 *   --bookingId  Booking ID                   (required)
 *   --host       Backend URL  (default: http://localhost:3000)
 *   --messages   Comma-separated list of messages to send (default: single test message)
 *   --delay      Delay in ms between messages  (default: 1000)
 *   --stress     Number of parallel clients to spin up (default: 1)
 */

const { io } = require('socket.io-client');

// ─── CLI arg parsing ──────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  const token = get('--token');
  const bookingId = parseInt(get('--bookingId') || '0', 10);
  const host = get('--host') || 'http://localhost:3000';
  const delay = parseInt(get('--delay') || '1000', 10);
  const stress = parseInt(get('--stress') || '1', 10);
  const messagesRaw = get('--messages');
  const messages = messagesRaw
    ? messagesRaw.split('||').map((m) => m.trim())
    : ['Hello, what amenities does the hotel have?'];

  if (!token || !bookingId) {
    console.error('\nUsage: node scripts/simulate-guest.js --token <JWT> --bookingId <id> [--host url] [--messages "msg1||msg2"] [--delay ms] [--stress n]\n');
    process.exit(1);
  }
  return { token, bookingId, host, delay, stress, messages };
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};
const tag = (label, color) => `${color}[${label}]${c.reset}`;
const ts = () => `${c.dim}${new Date().toISOString().slice(11, 23)}${c.reset}`;

// ─── Single guest session ─────────────────────────────────────────────────────
function runGuestSession(clientId, { token, bookingId, host, messages, delay }) {
  return new Promise((resolve, reject) => {
    const label = clientId > 1 ? `Guest-${clientId}` : 'Guest';
    console.log(`\n${ts()} ${tag(label, c.cyan)} Connecting to ${host}/chat ...`);

    const socket = io(`${host}/chat`, {
      transports: ['websocket'],
      auth: { token },
      query: { bookingId: String(bookingId) },
      reconnection: false,
    });

    const sessionStart = Date.now();
    let chatId = null;
    let messageIndex = 0;
    const results = [];

    // ── helpers ──────────────────────────────────────────────────────────────
    function elapsed(since) {
      return `${c.dim}+${Date.now() - since}ms${c.reset}`;
    }

    function sendNext() {
      if (messageIndex >= messages.length) {
        console.log(`\n${ts()} ${tag(label, c.cyan)} All messages sent. Disconnecting.`);
        printSummary();
        socket.disconnect();
        resolve(results);
        return;
      }
      const msg = messages[messageIndex++];
      const msgStart = Date.now();
      let chunks = [];

      console.log(`\n${ts()} ${tag(label, c.cyan)} ${c.bold}Sending:${c.reset} "${msg}"`);

      // Accumulate stream chunks
      let streamHandler;
      socket.on('stream_chunk', streamHandler = ({ content }) => {
        process.stdout.write(content); // live stream to terminal
        chunks.push(content);
      });

      // Final response
      socket.once('stream_end', ({ content, toolCalls }) => {
        socket.off('stream_chunk', streamHandler);
        const duration = Date.now() - msgStart;

        if (chunks.length > 0) {
          // newline after inline stream output
          process.stdout.write('\n');
        }

        console.log(`${ts()} ${tag(label, c.green)} Response complete ${elapsed(msgStart)}`);

        if (toolCalls && toolCalls.length > 0) {
          console.log(`${ts()} ${tag('Tools', c.magenta)} ${toolCalls.map((t) => t.name || t.tool).join(', ')}`);
        }

        results.push({ message: msg, response: content, duration, toolCalls });

        // Next message after delay
        setTimeout(sendNext, delay);
      });

      socket.emit('message', { content: msg });
    }

    function printSummary() {
      const totalMs = Date.now() - sessionStart;
      console.log(`\n${c.bold}${'─'.repeat(60)}${c.reset}`);
      console.log(`${c.bold}  Transcript — ${label} (chatId: ${chatId})${c.reset}`);
      console.log(`${'─'.repeat(60)}`);
      results.forEach((r, i) => {
        console.log(`\n  ${c.yellow}[${i + 1}] User:${c.reset} ${r.message}`);
        console.log(`      ${c.green}Samantha:${c.reset} ${r.response}`);
        console.log(`      ${c.dim}(${r.duration}ms${r.toolCalls?.length ? `, tools: ${r.toolCalls.map((t) => t.name || t.tool).join(', ')}` : ''})${c.reset}`);
      });
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`  ${c.dim}Total session time: ${totalMs}ms${c.reset}`);
      console.log(`${'─'.repeat(60)}\n`);
    }

    // ── event handlers ────────────────────────────────────────────────────────
    socket.on('connect', () => {
      console.log(`${ts()} ${tag(label, c.cyan)} Connected (id: ${socket.id})`);
    });

    socket.on('ready', ({ chatId: cid, messages: history }) => {
      chatId = cid;
      console.log(`${ts()} ${tag(label, c.green)} Ready — chatId: ${cid}, history: ${history?.length ?? 0} messages`);
      sendNext();
    });

    socket.on('auth_required', () => {
      // Server asked for explicit auth (no handshake token) — shouldn't happen with our setup
      console.log(`${ts()} ${tag(label, c.yellow)} auth_required received, sending auth event`);
      socket.emit('auth', { token, bookingId });
    });

    socket.on('error', (err) => {
      console.error(`${ts()} ${tag('ERROR', c.red)} ${JSON.stringify(err)}`);
      socket.disconnect();
      reject(new Error(err?.message || JSON.stringify(err)));
    });

    socket.on('disconnect', (reason) => {
      console.log(`${ts()} ${tag(label, c.dim)} Disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.error(`${ts()} ${tag('CONNECT_ERROR', c.red)} ${err.message}`);
      reject(err);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { token, bookingId, host, messages, delay, stress } = parseArgs();

  console.log(`\n${c.bold}Simulated Guest${c.reset} — stress=${stress}, messages=${messages.length}`);
  console.log(`${c.dim}Host: ${host}  BookingId: ${bookingId}${c.reset}\n`);

  if (stress === 1) {
    await runGuestSession(1, { token, bookingId, host, messages, delay });
  } else {
    // Parallel stress test — all clients fire simultaneously
    const sessions = Array.from({ length: stress }, (_, i) =>
      runGuestSession(i + 1, { token, bookingId, host, messages, delay }),
    );
    const results = await Promise.allSettled(sessions);
    const passed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`\n${c.bold}Stress Test Complete:${c.reset} ${c.green}${passed} passed${c.reset}, ${c.red}${failed} failed${c.reset}\n`);
  }
}

main().catch((err) => {
  console.error(`\n${c.red}Fatal:${c.reset}`, err.message);
  process.exit(1);
});
