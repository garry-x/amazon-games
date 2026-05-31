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
      prompt: 'top-down orthographic view of a complete ancient Egyptian game board, alternating light ivory alabaster and dark lapis lazuli square tiles in a 10x10 checkerboard grid, ornate gold hieroglyphic border frame around the edges, warm golden ambient light evenly distributed, luxurious temple floor, ultra detailed, seamless tileable texture, 8k',
      negative: 'blurry, perspective angle, shadows, people, text, modern elements, 3d depth, distorted',
    },
    'tile-light': {
      prompt: 'top-down view of a single square ivory alabaster stone tile with subtle golden veins, ancient Egyptian polished floor texture, warm sand color, smooth surface with micro details, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout lines, border, people, text, dark, 3d',
    },
    'tile-dark': {
      prompt: 'top-down view of a single square deep lapis lazuli stone tile with subtle golden flecks, ancient Egyptian polished floor texture, rich blue-black color, smooth surface with micro details, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout lines, border, people, text, light, 3d',
    },
    'piece-white': {
      prompt: 'A fierce Amazon warrior queen miniature figurine, wearing white and gold Greek-style battle armor, holding a drawn recurve bow ready to shoot, dynamic archer stance, ivory skin tone, gold crown with lapis lazuli gems, flowing cape, dramatic studio lighting from top-left, sharp focus on the bow and arrow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    'piece-black': {
      prompt: 'A fierce Amazon warrior queen miniature figurine, wearing dark bronze and black Greek-style battle armor, holding a drawn recurve bow ready to shoot, dynamic archer stance, dark skin tone, obsidian crown with ruby gems, flowing dark cape, dramatic rim lighting from top-left, sharp focus on the bow and arrow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    burn: {
      prompt: 'top-down view of a small circular crater burned into ancient sandstone floor, charred black edges, glowing orange embers at the bottom, cracked stone pattern radiating outward, smoke wisps, dark pit hole, dramatic overhead lighting, game texture asset, isolated on solid green screen background for transparency overlay, 8k',
      negative: 'perspective, 3d, characters, text, watermark, modern, grass',
    },
  },
  medieval: {
    bg: {
      prompt: 'Medieval castle great hall interior, massive stone walls with royal banners, grand fireplace with roaring fire, oak trestle table, suits of armor lining the walls, candlelit warm atmosphere, shafts of light through tall windows, cinematic, rich browns and golds, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, modern elements, people, text, watermark',
    },
    board: {
      prompt: 'top-down orthographic view of a complete medieval game board, alternating light oak and dark walnut square wood tiles in a 10x10 checkerboard grid, wrought iron border frame around the edges, warm firelight glow evenly distributed, castle great hall floor, ultra detailed, seamless tileable texture, 8k',
      negative: 'blurry, perspective angle, shadows, people, text, modern elements, 3d depth, distorted',
    },
    'tile-light': {
      prompt: 'top-down view of a single square light oak wood tile with fine grain texture, medieval polished floorboard, warm honey brown color, smooth surface with subtle wood rings, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout lines, border, people, text, dark, 3d',
    },
    'tile-dark': {
      prompt: 'top-down view of a single square dark walnut wood tile with rich grain texture, medieval polished floorboard, deep chocolate brown color, smooth surface with subtle wood rings, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout lines, border, people, text, light, 3d',
    },
    'piece-white': {
      prompt: 'A fierce medieval Amazon archer miniature figurine, wearing polished silver chainmail armor with a white surcoat, holding a drawn English longbow ready to shoot, dynamic archer stance, fair skin, iron crown with emerald gem, red cape, dramatic firelight from top-left, sharp focus on bow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    'piece-black': {
      prompt: 'A fierce medieval Amazon archer miniature figurine, wearing blackened steel plate armor with a dark surcoat, holding a drawn English longbow ready to shoot, dynamic archer stance, dark skin, iron crown with blood ruby, dark purple cape, dramatic rim lighting from top-left, sharp focus on bow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    burn: {
      prompt: 'top-down view of a small circular crater smashed into stone castle floor, charred black edges, glowing orange embers in the pit, cracked cobblestone radiating outward, smoke rising, dark hole, dramatic firelight, game texture asset, isolated on solid green screen background for transparency overlay, 8k',
      negative: 'perspective, 3d, characters, text, watermark, modern, grass',
    },
  },
  scifi: {
    bg: {
      prompt: 'Futuristic cyberpunk control room, holographic displays floating in air, neon blue and magenta lighting, reflective chrome surfaces, circuit trace patterns on walls, data streams, Blade Runner aesthetic, atmospheric fog, cinematic lighting, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, people, text, watermark, daylight, natural',
    },
    board: {
      prompt: 'top-down orthographic view of a complete futuristic game board, alternating brushed titanium and dark carbon fiber square panels in a 10x10 checkerboard grid, glowing neon cyan grid lines, chrome border frame, ambient blue tech glow evenly distributed, spaceship floor, ultra detailed, seamless tileable texture, 8k',
      negative: 'blurry, perspective angle, shadows, people, text, organic, wooden, 3d depth',
    },
    'tile-light': {
      prompt: 'top-down view of a single square brushed titanium metal panel with subtle circuit trace texture, futuristic sci-fi floor, cool silver-gray color, smooth metallic surface with micro etching details, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout, border, people, text, warm, organic, 3d',
    },
    'tile-dark': {
      prompt: 'top-down view of a single square dark carbon fiber panel with subtle hexagonal weave pattern, futuristic sci-fi floor, deep charcoal black color, matte surface with micro texture details, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout, border, people, text, bright, organic, 3d',
    },
    'piece-white': {
      prompt: 'A fierce cyberpunk Amazon sniper miniature figurine, wearing white and cyan high-tech combat armor with neon glow accents, holding a futuristic energy bow drawn ready to fire, dynamic combat stance, pale skin, holographic crown visor, sharp focus on the glowing energy arrow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    'piece-black': {
      prompt: 'A fierce cyberpunk Amazon sniper miniature figurine, wearing black and magenta high-tech combat armor with neon glow accents, holding a futuristic energy bow drawn ready to fire, dynamic combat stance, dark skin, holographic skull visor, sharp focus on the glowing energy arrow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    burn: {
      prompt: 'top-down view of a small circular plasma burn crater on a dark metal floor, glowing neon cyan edges, molten metal splatter pattern radiating outward, electric sparks in the pit, dark scorched hole, futuristic sci-fi damage, game texture asset, isolated on solid green screen background for transparency overlay, 8k',
      negative: 'perspective, 3d, characters, text, watermark, nature, organic',
    },
  },
  nature: {
    bg: {
      prompt: 'Enchanted forest glade, ancient moss-covered standing stones, magical glowing plants and mushrooms, golden sunbeams filtering through emerald canopy, fairy lights floating in air, ethereal mystical atmosphere, cinematic composition, rich greens and warm golds, 8k ultra detailed, masterpiece',
      negative: 'blurry, low quality, modern, buildings, people, text, watermark',
    },
    board: {
      prompt: 'top-down orthographic view of a complete nature-themed game board, alternating light mossy limestone and dark slate square tiles in a 10x10 checkerboard grid, living vine border frame with small leaves around the edges, dappled forest sunlight evenly distributed, ancient forest floor, ultra detailed, seamless tileable texture, 8k',
      negative: 'blurry, perspective angle, shadows, people, text, modern, metal, 3d depth',
    },
    'tile-light': {
      prompt: 'top-down view of a single square light mossy limestone tile with subtle fossil texture, ancient forest floor, pale sage green-gray color, smooth weathered stone surface with tiny moss spots, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout, border, people, text, dark, modern, 3d',
    },
    'tile-dark': {
      prompt: 'top-down view of a single square dark slate stone tile with subtle mineral flecks, ancient forest floor, deep charcoal green-gray color, smooth polished stone surface with micro crystal details, seamless tileable, ultra detailed, 8k, game texture asset',
      negative: 'shadows, perspective, grout, border, people, text, bright, modern, 3d',
    },
    'piece-white': {
      prompt: 'A fierce elven Amazon ranger miniature figurine, wearing white and green leaf-armor with delicate vine patterns, holding a drawn elegant elven longbow ready to shoot, dynamic archer stance, fair skin with elf ears, crown of woven white flowers, emerald cape, dramatic golden sunlight from top-left, sharp focus on bow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    'piece-black': {
      prompt: 'A fierce dark elven Amazon ranger miniature figurine, wearing black and deep purple shadow-leaf armor, holding a drawn elegant darkwood longbow ready to shoot, dynamic archer stance, dark skin with elf ears, crown of black thorns, midnight blue cape, dramatic moonlight from top-left, sharp focus on bow, product photography, centered, isolated on solid green screen background for transparency, 8k',
      negative: 'multiple figures, full body, background scene, blurry, low quality, modern gun, text, watermark, ugly, deformed',
    },
    burn: {
      prompt: 'top-down view of a small circular scorched crater in mossy forest floor, charred black edges, glowing orange embers, cracked earth and burnt roots radiating outward, smoke and ash, dark pit hole, dappled forest light, game texture asset, isolated on solid green screen background for transparency overlay, 8k',
      negative: 'perspective, 3d, characters, text, watermark, modern, metal',
    },
  },
};

const SIZES = {
  bg: { width: 1920, height: 1080 },
  board: { width: 2048, height: 2048 },
  'piece-white': { width: 1024, height: 1024 },
  'piece-black': { width: 1024, height: 1024 },
  burn: { width: 1024, height: 1024 },
  'tile-light': { width: 1024, height: 1024 },
  'tile-dark': { width: 1024, height: 1024 },
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
    all: ['bg', 'board', 'tile-light', 'tile-dark', 'piece-white', 'piece-black', 'burn'],
    bg: ['bg'],
    board: ['board', 'tile-light', 'tile-dark'],
    tile: ['tile-light', 'tile-dark'],
    piece: ['piece-white', 'piece-black'],
    burn: ['burn'],
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
