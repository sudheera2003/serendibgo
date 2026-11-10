/**
 * One command for testing on a phone: `npm run dev` from the repo root.
 *
 * 1. Checks that MySQL (XAMPP) is running.
 * 2. Starts the backend (logs go to backend/dev.log) and checks it can reach the database.
 * 3. Starts Expo with --tunnel. Metro forwards /api to the backend (mobile/metro.config.js),
 *    so the phone needs only that one tunnel and doesn't have to be on the same Wi-Fi.
 * Then just scan the QR code in Expo Go. Ctrl+C stops everything.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const MOBILE = path.join(ROOT, 'mobile');
const BACKEND_LOG = path.join(BACKEND, 'dev.log');
const PORT = 4000;
const DB_PORT = 3306;

const log = (msg) => console.log(`\x1b[36m[dev]\x1b[0m ${msg}`);
const children = [];

// Expo's tunnel host is <urlRandomness>-<user>-8081.exp.direct; payment and upload links need it.
function tunnelUrl() {
  try {
    const { urlRandomness } = JSON.parse(fs.readFileSync(path.join(MOBILE, '.expo', 'settings.json'), 'utf8'));
    if (urlRandomness) return `http://${urlRandomness.toLowerCase()}-anonymous-8081.exp.direct`;
  } catch {}
  return undefined;
}

// An older version of this script wrote a separate API tunnel URL here; it would override the Metro route.
function removeOldEnvFile() {
  const file = path.join(MOBILE, '.env.local');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('scripts/dev.js')) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}

function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.end(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`nothing listening on port ${port}`));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.end(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
}

function run(cmd, args, opts) {
  const child = spawn([cmd, ...args].join(' '), { shell: true, ...opts });
  children.push(child);
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try {
      if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      else child.kill('SIGTERM');
    } catch {}
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

(async () => {
  // MySQL is deliberately not started from here: closing this terminal would force-kill it,
  // and an unclean stop is what corrupts XAMPP's InnoDB files. XAMPP (ideally as a service) owns it.
  if (!(await portInUse(DB_PORT))) {
    log(`\x1b[31mMySQL is not running. Open the XAMPP Control Panel, click Start next to MySQL, then run this again.\x1b[0m`);
    process.exit(1);
  }
  log('MySQL ready.');

  if (await portInUse(PORT)) {
    log(`Port ${PORT} is already in use. Stop the other backend first (close its terminal), then run this again.`);
    process.exit(1);
  }

  log(`Starting backend (logs: backend/dev.log)...`);
  const out = fs.openSync(BACKEND_LOG, 'w');
  const publicUrl = tunnelUrl();
  const backend = run('npm', ['run', 'dev'], {
    cwd: BACKEND,
    stdio: ['ignore', out, out],
    env: publicUrl ? { ...process.env, PUBLIC_API_URL: publicUrl } : process.env,
  });
  backend.on('exit', (code) => {
    if (shuttingDown) return;
    log(`\x1b[31mBackend stopped (exit ${code}). See backend/dev.log.\x1b[0m`);
    shutdown(1);
  });
  try {
    await waitForPort(PORT);
  } catch {
    log('\x1b[31mBackend did not start. Last lines of backend/dev.log:\x1b[0m');
    console.log(fs.readFileSync(BACKEND_LOG, 'utf8').split('\n').slice(-15).join('\n'));
    return shutdown(1);
  }
  const health = await fetch(`http://localhost:${PORT}/health`).catch(() => null);
  if (!health?.ok) {
    log('\x1b[31mBackend is up but /health failed - usually the database. Check backend/dev.log.\x1b[0m');
    return shutdown(1);
  }
  log('Backend ready (database OK).');

  // The API address is baked into the bundle, so clear Metro's cache when it changed.
  const clear = removeOldEnvFile();

  // Expo's ngrok tunnel sometimes times out while connecting; retry a failed start a couple of times.
  const startExpo = (attempt, clearCache) => {
    log(attempt === 1 ? 'Starting Expo - scan the QR code below with Expo Go.' : `Retrying Expo (attempt ${attempt} of 3)...`);
    const startedAt = Date.now();
    const expo = run('npx', ['expo', 'start', '--tunnel', 'ngrok', ...(clearCache ? ['--clear'] : [])], {
      cwd: MOBILE,
      stdio: 'inherit',
    });
    expo.on('exit', (code) => {
      if (shuttingDown) return;
      const failedEarly = code !== 0 && Date.now() - startedAt < 5 * 60 * 1000;
      if (failedEarly && attempt < 3) return startExpo(attempt + 1, false);
      shutdown(code ?? 0);
    });
  };
  startExpo(1, clear);
})().catch((e) => {
  log(`\x1b[31m${e.message}\x1b[0m`);
  shutdown(1);
});
