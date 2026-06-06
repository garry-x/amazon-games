/**
 * App icon generator — uses ComfyUI (http://127.0.0.1:8188) with Flux.1 Dev
 * to generate Math Games app icons for Android.
 *
 * Usage: node scripts/generate-icons.mjs [--comfy-url http://...]
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const API = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const OUT_BASE = resolve(ROOT, 'android/app/src/main/res');

// ── Android icon sizes ─────────────────────────────────────────
// Adaptive icon foreground (108dp × 108dp at 48dp safe zone)
const FOREGROUND_SIZES = [
  { dir: 'mipmap-mdpi',    px: 108 },
  { dir: 'mipmap-hdpi',    px: 162 },
  { dir: 'mipmap-xhdpi',   px: 216 },
  { dir: 'mipmap-xxhdpi',  px: 324 },
  { dir: 'mipmap-xxxhdpi', px: 432 },
];

// Legacy icons
const LEGACY_SIZES = [
  { dir: 'mipmap-mdpi',    px: 48 },
  { dir: 'mipmap-hdpi',    px: 72 },
  { dir: 'mipmap-xhdpi',   px: 96 },
  { dir: 'mipmap-xxhdpi',  px: 144 },
  { dir: 'mipmap-xxxhdpi', px: 192 },
];

// ── ComfyUI API ─────────────────────────────────────────────────

async function queuePrompt(workflow) {
  const res = await fetch(`${API}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'math-games-icons' }),
  });
  if (!res.ok) throw new Error(`Prompt failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`Prompt error: ${JSON.stringify(data.error)}`);
  return data.prompt_id;
}

async function waitForPrompt(promptId, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${API}/history/${promptId}`);
    const data = await res.json();
    if (data[promptId]) return data[promptId];
    await sleep(2000);
  }
  throw new Error(`Timeout waiting for prompt ${promptId}`);
}

async function fetchImage(filename, subfolder, type) {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${API}/view?${params}`);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Flux.1 Dev workflow ─────────────────────────────────────────

function buildIconWorkflow({ prompt, width, height, steps = 20, guidance = 3.5, seed }) {
  return {
    '1': { inputs: { clip_name1: 'clip_l.safetensors', clip_name2: 't5xxl_fp16.safetensors', type: 'flux' }, class_type: 'DualCLIPLoader' },
    '2': { inputs: { unet_name: 'flux1-dev.safetensors', weight_dtype: 'fp8_e4m3fn' }, class_type: 'UNETLoader' },
    '3': { inputs: { vae_name: 'ae.safetensors' }, class_type: 'VAELoader' },
    '4': { inputs: { clip: ['1', 0], clip_l: prompt, t5xxl: prompt, guidance }, class_type: 'CLIPTextEncodeFlux' },
    '5': { inputs: { width, height, batch_size: 1 }, class_type: 'EmptyFlux2LatentImage' },
    '6': { inputs: { model: ['2', 0], max_shift: 1.15, base_shift: 0.5, width, height }, class_type: 'ModelSamplingFlux' },
    '7': { inputs: { noise_seed: seed }, class_type: 'RandomNoise' },
    '8': { inputs: { model: ['6', 0], scheduler: 'simple', steps, denoise: 1 }, class_type: 'BasicScheduler' },
    '9': { inputs: { sampler_name: 'euler' }, class_type: 'KSamplerSelect' },
    '10': { inputs: { conditioning: ['4', 0], guidance }, class_type: 'FluxGuidance' },
    '11': { inputs: { model: ['6', 0], conditioning: ['10', 0] }, class_type: 'BasicGuider' },
    '12': { inputs: { noise: ['7', 0], guider: ['11', 0], sampler: ['9', 0], sigmas: ['8', 0], latent_image: ['5', 0] }, class_type: 'SamplerCustomAdvanced' },
    '13': { inputs: { samples: ['12', 0], vae: ['3', 0] }, class_type: 'VAEDecode' },
    '14': { inputs: { images: ['13', 0] }, class_type: 'PreviewImage' },
  };
}

// ── Icon prompts ────────────────────────────────────────────────

const ICON_PROMPTS = {
  foreground: {
    prompt: 'A beautifully designed mobile app icon for a strategy math game collection called "Math Games", centered composition, featuring a golden geometric chess knight piece made of mathematical symbols (+, -, ×, ÷, =) in gold on a deep dark indigo background with subtle hexagonal grid pattern, minimalist flat design with subtle 3D depth, clean edges suitable for small icon sizes, no text or letters visible, professional app store quality, vibrant gold highlights, dark mode aesthetic, 8k, masterpiece',
    negative: 'text, letters, words, watermark, photo, realistic face, people, blurry, messy, cluttered, low quality, jpeg artifacts, busy background',
  },
};

// ── Generate ────────────────────────────────────────────────────

async function generateIcon(name, promptConfig, width, height) {
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const { prompt, negative } = promptConfig;

  console.log(`\n  📐 ${name}  ${width}×${height}  seed=${seed}`);
  console.log(`     prompt: ${prompt.slice(0, 100)}...`);

  const workflow = buildIconWorkflow({
    prompt,
    width,
    height,
    steps: 20,
    guidance: 3.5,
    seed,
  });

  // Add negative prompt to the CLIPTextEncodeFlux node
  workflow['4'].inputs.clip_l = prompt;
  workflow['4'].inputs.t5xxl = prompt;

  console.log('     → Queuing ComfyUI workflow...');
  const promptId = await queuePrompt(workflow);
  console.log(`     → Waiting for generation (prompt_id: ${promptId})...`);

  const start = Date.now();
  const result = await waitForPrompt(promptId, 600_000); // 10 min timeout
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const outputs = result.outputs;
  if (!outputs || Object.keys(outputs).length === 0) {
    throw new Error('No outputs from workflow');
  }

  const outputKey = Object.keys(outputs)[0];
  const output = outputs[outputKey];
  const images = output.images || [];
  if (images.length === 0) throw new Error('No images in output');

  const img = images[0];
  console.log(`     → Downloading ${img.filename}...`);
  const buffer = await fetchImage(img.filename, img.subfolder, img.type);
  console.log(`     ✓ Generated in ${elapsed}s  (${(buffer.length / 1024).toFixed(0)} KB)`);

  return buffer;
}

async function resizeIcons(sourceBuffer, sizes, suffix) {
  for (const { dir, px } of sizes) {
    const outDir = resolve(OUT_BASE, dir);
    mkdirSync(outDir, { recursive: true });

    const outPath = resolve(outDir, `ic_launcher${suffix}.png`);
    await sharp(sourceBuffer)
      .resize(px, px, { fit: 'cover' })
      .png()
      .toFile(outPath);
    console.log(`     ✓ ${dir}/ic_launcher${suffix}.png  (${px}×${px})`);
  }
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('🎨 Math Games — App Icon Generator');
  console.log(`   ComfyUI: ${API}\n`);

  // Check ComfyUI
  try {
    const sys = await fetch(`${API}/system_stats`).then(r => r.json());
    console.log(`   ComfyUI v${sys.system?.comfyui_version || '?'}  |  ${sys.devices?.[0]?.name || 'unknown device'}\n`);
  } catch {
    console.error('✗ Cannot reach ComfyUI. Start ComfyUI first:\n  cd ~/ComfyUI && python main.py --listen 0.0.0.0 --port 8188');
    process.exit(1);
  }

  // 1. Generate foreground icon (1024×1024 base, then resize)
  console.log('━━━ Step 1/2: Foreground icon ━━━');
  console.log('   Generating 1024×1024 app icon with Flux.1 Dev...');
  console.log('   This takes ~30-60s on a fast GPU...');

  const fgBuffer = await generateIcon('foreground', ICON_PROMPTS.foreground, 1024, 1024);

  // Save base icon
  const baseDir = resolve(ROOT, 'public');
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(resolve(baseDir, 'icon-base-1024.png'), fgBuffer);
  console.log('     ✓ Saved base icon → public/icon-base-1024.png');

  // 2. Resize to all Android sizes
  console.log('\n━━━ Step 2/2: Resizing to Android densities ━━━');

  console.log('   Adaptive icon foreground:');
  await resizeIcons(fgBuffer, FOREGROUND_SIZES, '_foreground');

  console.log('   Legacy icon:');
  await resizeIcons(fgBuffer, LEGACY_SIZES, '');

  console.log('   Round icon:');
  await resizeIcons(fgBuffer, LEGACY_SIZES, '_round');

  // 3. Update background color to match dark theme
  const bgXml = resolve(OUT_BASE, 'values/ic_launcher_background.xml');
  const bgContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A0A14</color>
</resources>`;
  writeFileSync(bgXml, bgContent);
  console.log('\n     ✓ Updated icon background → #0A0A14 (dark)');

  // 4. Summary
  console.log('\n━━━ Done ━━━');
  console.log('   Generated icons:');
  for (const { dir, px } of FOREGROUND_SIZES) {
    console.log(`     ${dir}/ic_launcher_foreground.png  ${px}×${px}`);
  }
  console.log('   (+ legacy & round variants)');
  console.log(`\n   Base icon: public/icon-base-1024.png\n`);
}

main().catch(err => { console.error(`\n✗ ${err.message}`); process.exit(1); });
