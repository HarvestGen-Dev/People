// <!-- AGENT: INTEGRATION -->
import net from 'node:net';
import { spawn } from 'node:child_process';

const appPort = Number(process.env.PLAYWRIGHT_PORT || 3217);
const smtpPort = Number(process.env.E2E_SMTP_PORT || 3218);

const smtp = net.createServer((socket) => {
  let buffer = '';
  let receivingData = false;
  socket.write('220 local-e2e ESMTP\r\n');

  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    while (buffer.length > 0) {
      if (receivingData) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end === -1) return;
        buffer = buffer.slice(end + 5);
        receivingData = false;
        socket.write('250 accepted\r\n');
        continue;
      }

      const lineEnd = buffer.indexOf('\n');
      if (lineEnd === -1) return;
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      const command = line.toUpperCase();
      if (command.startsWith('EHLO') || command.startsWith('HELO')) {
        socket.write('250-local-e2e\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
      } else if (command.startsWith('AUTH')) {
        socket.write('235 authenticated\r\n');
      } else if (command.startsWith('MAIL') || command.startsWith('RCPT')) {
        socket.write('250 accepted\r\n');
      } else if (command === 'DATA') {
        receivingData = true;
        socket.write('354 end with <CRLF>.<CRLF>\r\n');
      } else if (command === 'QUIT') {
        socket.write('221 closing\r\n');
        socket.end();
      } else if (command) {
        socket.write('250 accepted\r\n');
      }
    }
  });
});

await new Promise((resolve, reject) => {
  smtp.once('error', reject);
  smtp.listen(smtpPort, '127.0.0.1', resolve);
});

const next = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(appPort),
  ],
  {
    env: {
      ...process.env,
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtpPort),
      BREVO_SMTP_USER: 'synthetic-e2e-user',
      BREVO_SMTP_KEY: 'synthetic-e2e-key',
    },
    stdio: 'inherit',
  }
);

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!next.killed) next.kill('SIGTERM');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
next.on('exit', (code) => {
  smtp.close(() => process.exit(shuttingDown ? 0 : (code ?? 1)));
});
