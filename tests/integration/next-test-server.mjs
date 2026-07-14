// <!-- AGENT: INTEGRATION -->
import { spawn } from 'node:child_process';

const MAX_LOG_LENGTH = 8000;

function appendLog(current, chunk) {
  const next = current + chunk.toString();
  return next.length > MAX_LOG_LENGTH
    ? next.slice(next.length - MAX_LOG_LENGTH)
    : next;
}

export function startNextDevServer({ port, env = {} }) {
  const server = spawn(
    './node_modules/.bin/next',
    ['dev', '--hostname', '127.0.0.1', '--port', `${port}`],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let output = '';
  let exitDetails = null;

  server.stdout.on('data', (chunk) => {
    output = appendLog(output, chunk);
  });

  server.stderr.on('data', (chunk) => {
    output = appendLog(output, chunk);
  });

  server.on('exit', (code, signal) => {
    exitDetails = { code, signal };
  });

  return {
    process: server,
    getOutput: () => output.trim(),
    getExitDetails: () => exitDetails,
  };
}

export async function waitForNextDevServer({ server, baseUrl }) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const exitDetails = server.getExitDetails();
    if (exitDetails) {
      throw new Error(
        [
          `Next.js test server exited before becoming ready (code=${exitDetails.code}, signal=${exitDetails.signal}).`,
          server.getOutput() || 'No server output captured.',
        ].join('\n')
      );
    }

    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    [
      'Timed out waiting for the Next.js test server.',
      server.getOutput() || 'No server output captured.',
    ].join('\n')
  );
}
