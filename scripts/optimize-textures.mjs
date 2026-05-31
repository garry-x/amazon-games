/**
 * Convert PNG textures to WebP for smaller build size.
 * Usage: node scripts/optimize-textures.mjs
 */
import sharp from 'sharp';
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIRS = ['public/textures', 'public/vfx', 'public/avatars'];

let totalBefore = 0, totalAfter = 0;

for (const dir of DIRS) {
  const full = resolve(ROOT, dir);
  if (!existsSync(full)) continue;

  const files = readdirSync(full).filter(f => f.endsWith('.png'));
  for (const file of files) {
    const pngPath = resolve(full, file);
    const webpPath = pngPath.replace('.png', '.webp');
    const before = statSync(pngPath).size;
    totalBefore += before;

    // Skip if WebP already exists and is newer
    if (existsSync(webpPath) && statSync(webpPath).mtime > statSync(pngPath).mtime) {
      totalAfter += statSync(webpPath).size;
      continue;
    }

    try {
      await sharp(pngPath)
        .webp({ quality: 80, effort: 4 })
        .toFile(webpPath);
      const after = statSync(webpPath).size;
      totalAfter += after;
      const pct = ((1 - after / before) * 100).toFixed(0);
      console.log(`  ${file} → ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (${pct}% smaller)`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
      totalAfter += before; // keep original
    }
  }
}

const saved = totalBefore - totalAfter;
console.log(`\nTotal: ${(totalBefore/1024/1024).toFixed(1)}MB → ${(totalAfter/1024/1024).toFixed(1)}MB (saved ${(saved/1024/1024).toFixed(1)}MB)`);
