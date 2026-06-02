import { existsSync, mkdirSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:5174/';
const OUT_DIR = resolve(ROOT, 'screenshots');
const OUT_FILE = resolve(OUT_DIR, 'smoke-setup.png');

const candidates = [
  process.env.CHROMIUM_PATH,
  '/snap/chromium/current/usr/lib/chromium-browser/chrome',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter(Boolean);

const chrome = candidates.find(path => existsSync(path));
if (!chrome) {
  throw new Error('Chromium not found. Set CHROMIUM_PATH to a Chrome/Chromium executable.');
}

function chromeArgs(extra) {
  return [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    ...extra,
  ];
}

const html = await fetch(URL).then(res => res.text());
if (!html.includes('亚马逊棋')) {
  throw new Error('Smoke failed: app HTML did not contain expected title text.');
}

mkdirSync(OUT_DIR, { recursive: true });
execFileSync(chrome, chromeArgs([
  '--virtual-time-budget=3000',
  '--window-size=390,844',
  `--screenshot=${OUT_FILE}`,
  URL,
]), { encoding: 'utf8', timeout: 45000 });

const size = statSync(OUT_FILE).size;
if (size < 50_000) {
  throw new Error(`Smoke failed: screenshot too small (${size} bytes).`);
}

console.log(`Smoke passed: ${URL}`);
console.log(`Screenshot: ${OUT_FILE} (${Math.round(size / 1024)} KB)`);
