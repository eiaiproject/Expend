import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const previewPort = 4174;
const debugPort = 9223;
const url = `http://${host}:${previewPort}`;

function startPreview() {
  const child = spawn('npm', ['run', 'preview', '--', '--host=127.0.0.1', `--port=${previewPort}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return child;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }
    await delay(500);
  }
  throw new Error(`Preview server did not start at ${url}`);
}

const preview = startPreview();

try {
  await waitForServer();
  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${debugPort}`],
  });

  try {
    const runnerResult = await lighthouse(url, {
      port: debugPort,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['accessibility', 'best-practices', 'seo'],
    });

    if (!runnerResult?.lhr) {
      throw new Error('Lighthouse did not return a report.');
    }

    const scores = Object.fromEntries(
      Object.entries(runnerResult.lhr.categories).map(([key, value]) => [key, value.score ?? 0]),
    );

    const thresholds = {
      accessibility: 0.85,
      'best-practices': 0.80,
      seo: 0.70,
    };

    for (const [category, threshold] of Object.entries(thresholds)) {
      const score = scores[category] ?? 0;
      if (score < threshold) {
        throw new Error(`Lighthouse ${category} score ${score} is below ${threshold}`);
      }
    }

    console.log('Lighthouse smoke QA passed:', scores);
  } finally {
    await browser.close();
  }
} finally {
  // Kill the entire process group (npm + vite + all children)
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {
    // Process group might already be gone
  }
  // Force kill if still alive after 2 seconds
  setTimeout(() => {
    try {
      process.kill(-preview.pid, 'SIGKILL');
    } catch {
      // Already dead
    }
  }, 2000);
}
