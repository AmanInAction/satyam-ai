import { spawn } from 'node:child_process';

// Next.js dev server CLI option translator
// AI Studio control plane executes `npm run dev --port 3000 --host 0.0.0.0`
// Next.js CLI expects `-H` or `--hostname`, but rejects `--host`.
// This wrapper normalizes `--host <value>` to `-H <value>` before delegating to `next dev`.

const rawArgs = process.argv.slice(2);
const normalizedArgs = [];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--host') {
    normalizedArgs.push('-H', rawArgs[++i] || '0.0.0.0');
  } else if (arg.startsWith('--host=')) {
    normalizedArgs.push('-H', arg.slice('--host='.length));
  } else {
    normalizedArgs.push(arg);
  }
}

// Ensure default port 3000 and hostname 0.0.0.0 if not already specified
if (!normalizedArgs.includes('-p') && !normalizedArgs.includes('--port')) {
  normalizedArgs.push('-p', process.env.PORT || '3000');
}
if (!normalizedArgs.includes('-H') && !normalizedArgs.includes('--hostname')) {
  normalizedArgs.push('-H', '0.0.0.0');
}

const child = spawn('next', ['dev', ...normalizedArgs], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
