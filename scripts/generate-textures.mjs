/**
 * Build-time asset generator — uses ComfyUI (http://127.0.0.1:8188)
 * to pre-generate high-resolution background & board textures.
 *
 * Usage: node scripts/generate-textures.mjs [theme] [type]
 *   theme: all | egyptian | medieval | scifi | nature
 *   type:  all | bg | board | piece
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/textures');
const API = 'http://127.0.0.1:8188';

// ── Prompt templates ─────────────────────────────────────────
const PROMPTS = {
  egyptian: {
    bg: {
      prompt: 'Ancient Egyptian temple interior, golden sandstone columns with hieroglyphic carvings, warm torchlight casting dramatic shadows, ornate golden artifacts on pedestals, mystical dust particles in light rays, cinematic composition, rich warm colors, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, distorted, watermark, text, modern elements, people',
    },
    board: {
      prompt: 'top-down view of an ornate ancient Egyptian game board made of gold-inlaid sandstone and deep lapis lazuli tiles arranged in a checkerboard grid pattern, hieroglyphic border decorations, warm golden light, marble texture, luxurious craftsmanship, 8k ultra detailed, tile texture, seamless pattern',
      negative: 'blurry, perspective, 3d, shadows, people, low quality, modern, distorted',
    },
    'piece-white': {
      prompt: 'A single elegant ivory chess queen piece with ancient Egyptian gold crown and lapis lazuli gem inlays, ornate hieroglyphic engravings on the base, standing on a circular pedestal, regal posture, dramatic studio lighting from top-left, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
    'piece-black': {
      prompt: 'A single majestic obsidian chess queen piece with ancient Egyptian gold crown and ruby gem inlays, ornate hieroglyphic engravings on the base, standing on a circular pedestal, dark elegant presence, dramatic studio lighting from top-left with rim light, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
  },
  medieval: {
    bg: {
      prompt: 'Medieval castle great hall interior, massive stone walls with royal banners, grand fireplace with roaring fire, oak trestle table, suits of armor lining the walls, candlelit warm atmosphere, shafts of light through tall windows, cinematic, rich browns and golds, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, modern elements, people, text, watermark',
    },
    board: {
      prompt: 'top-down view of a medieval game board made of rich oak and dark walnut wood inlay in square checkerboard pattern, wrought iron corner rivets, castle stone border edge, warm firelight glow, wood grain texture, handcrafted medieval craftsmanship, 8k ultra detailed, tile texture, seamless',
      negative: 'blurry, perspective, 3d, shadows, modern, distorted, low quality',
    },
    'piece-white': {
      prompt: 'A single elegant ivory marble chess queen piece with medieval iron crown and emerald gem, ornate Gothic engravings on the base, standing on a circular stone pedestal, regal and noble posture, dramatic firelight from top-left, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
    'piece-black': {
      prompt: 'A single majestic dark iron chess queen piece with medieval steel crown and ruby gem, ornate Gothic engravings on the base, standing on a circular stone pedestal, dark imposing presence, dramatic firelight from top-left with rim light, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
  },
  scifi: {
    bg: {
      prompt: 'Futuristic cyberpunk control room, holographic displays floating in air, neon blue and magenta lighting, reflective chrome surfaces, circuit trace patterns on walls, data streams, Blade Runner aesthetic, atmospheric fog, cinematic lighting, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, people, text, watermark, daylight, natural',
    },
    board: {
      prompt: 'top-down view of a holographic game grid floating above a brushed dark metal surface, glowing neon cyan grid lines in square checkerboard pattern, circuit trace decorations, chrome border edge, ambient blue glow, futuristic sci-fi aesthetic, 8k ultra detailed, tile texture, seamless',
      negative: 'blurry, perspective, 3d, shadows, natural, wood, stone, low quality',
    },
    'piece-white': {
      prompt: 'A single sleek white chrome chess queen piece with neon cyan holographic crown and circuit trace engravings, standing on a glowing circular base, futuristic cyberpunk aesthetic, dramatic blue and white studio lighting from top-left, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
    'piece-black': {
      prompt: 'A single sleek dark titanium chess queen piece with neon magenta holographic crown and circuit trace engravings, standing on a glowing circular base, futuristic cyberpunk aesthetic, dramatic purple and blue rim lighting, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
  },
  nature: {
    bg: {
      prompt: 'Enchanted forest glade, ancient moss-covered standing stones, magical glowing plants and mushrooms, golden sunbeams filtering through emerald canopy, fairy lights floating in air, ethereal mystical atmosphere, cinematic composition, rich greens and warm golds, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, modern, buildings, people, text, watermark',
    },
    board: {
      prompt: 'top-down view of a natural stone game board with carved stone tiles in checkerboard pattern, lush green moss growing between squares, vine border decorations, dappled forest sunlight, organic natural texture, elven forest craftsmanship, 8k ultra detailed, tile texture, seamless',
      negative: 'blurry, perspective, 3d, shadows, modern, metal, plastic, low quality',
    },
    'piece-white': {
      prompt: 'A single elegant white birch wood chess queen piece with woven vine crown and small emerald leaf gems, delicate nature-inspired carvings on the base, standing on a circular wooden pedestal, elven forest aesthetic, dramatic golden forest light from top-left, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
    'piece-black': {
      prompt: 'A single majestic dark walnut wood chess queen piece with thorn vine crown and deep amber gems, intricate nature carvings on the base, standing on a circular wooden pedestal, dark forest mystique, dramatic moonlight from top-left with rim light, sharp focus, product photography, centered, isolated on pure white background',
      negative: 'multiple pieces, board, background scene, blurry, low quality, hands, text, watermark',
    },
  },
};

const SIZES = {
  bg: { width: 1920, height: 1080 },
  board: { width: 2048, height: 2048 },
  'piece-white': { width: 1024, height: 1024 },
  'piece-black': { width: 1024, height: 1024 },
};

// ── ComfyUI API helpers ──────────────────────────────────────

async function queuePrompt(workflow) {
  const res = await fetch(`${API}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'amazon-games-build' }),
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

// ── Flux.1 Dev workflow builder ───────────────────────────────

function buildWorkflow({ prompt, width, height, steps = 20, guidance = 3.5, seed }) {
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

// ── Main ──────────────────────────────────────────────────────

async function generateOne(themeId, type) {
  const prompts = PROMPTS[themeId];
  if (!prompts || !prompts[type]) throw new Error(`No prompt for ${themeId}/${type}`);

  const size = SIZES[type];
  const seed = Math.floor(Math.random() * 1_000_000_000);

  console.log(`  → ${themeId}/${type}  ${size.width}×${size.height}  seed=${seed}`);

  const workflow = buildWorkflow({
    prompt: prompts[type].prompt,
    width: size.width,
    height: size.height,
    steps: 20,
    guidance: 3.5,
    seed,
  });

  console.log('    submitting...');
  const promptId = await queuePrompt(workflow);
  console.log(`    queued: ${promptId}`);

  const history = await waitForPrompt(promptId);
  console.log('    completed, downloading...');

  // Extract first image
  for (const nodeId of Object.keys(history.outputs)) {
    const imgs = history.outputs[nodeId]?.images;
    if (imgs && imgs.length > 0) {
      const buf = await fetchImage(imgs[0].filename, imgs[0].subfolder, imgs[0].type);
      const outPath = resolve(OUT_DIR, `${themeId}-${type}.png`);
      writeFileSync(outPath, buf);
      console.log(`    saved: ${outPath}  (${(buf.length / 1024).toFixed(0)} KB)`);
      return outPath;
    }
  }
  throw new Error('No image in output');
}

async function main() {
  const themeArg = process.argv[2] || 'all';
  const typeArg = process.argv[3] || 'all';

  const themes = themeArg === 'all' ? Object.keys(PROMPTS) : [themeArg];
  const typeMap = {
    all: ['bg', 'board', 'piece-white', 'piece-black'],
    bg: ['bg'],
    board: ['board'],
    piece: ['piece-white', 'piece-black'],
    'piece-white': ['piece-white'],
    'piece-black': ['piece-black'],
  };
  const types = typeMap[typeArg] || [typeArg];

  // Validate
  for (const t of themes) {
    if (!PROMPTS[t]) { console.error(`Unknown theme: ${t}`); process.exit(1); }
  }
  for (const t of types) {
    if (!SIZES[t]) { console.error(`Unknown type: ${t}`); process.exit(1); }
  }

  // Check ComfyUI
  try {
    const res = await fetch(`${API}/system_stats`);
    if (!res.ok) throw new Error('not ok');
  } catch {
    console.error('✗ ComfyUI not running at', API);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const total = themes.length * types.length;
  let done = 0;

  console.log(`\n⚔  Amazon Games — Asset Generation`);
  console.log(`   Themes: ${themes.join(', ')}`);
  console.log(`   Types:  ${types.join(', ')}`);
  console.log(`   Total:  ${total} assets\n`);

  for (const theme of themes) {
    for (const type of types) {
      const label = `[${done + 1}/${total}]`;
      console.log(`${label} ${theme}/${type}`);
      try {
        await generateOne(theme, type);
        done++;
      } catch (err) {
        console.error(`    ✗ FAILED: ${err.message}`);
        process.exit(1);
      }
    }
  }

  console.log(`\n✓ Done — ${done} assets generated to ${OUT_DIR}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
