/**
 * Texture manager — generates, caches, and serves AI-generated textures
 * for board backgrounds and game atmospheres.
 */

import { generateImage } from './client';
import { buildFluxWorkflow, THEME_PROMPTS, type GenParams } from './workflows';

type AssetType = 'bg' | 'board';

interface CacheEntry {
  dataUrl: string;
  timestamp: number;
}

export type GenerationProgress = {
  status: 'idle' | 'generating' | 'done' | 'error';
  current: number;
  total: number;
  label: string;
  error?: string;
};

type ProgressCallback = (p: GenerationProgress) => void;

class TextureManager {
  // In-memory cache: key = `${themeId}:${type}`
  private cache = new Map<string, CacheEntry>();
  private generating = false;

  /** Get a cached texture, or undefined if not available. */
  get(themeId: string, type: AssetType): string | undefined {
    const key = `${themeId}:${type}`;
    const entry = this.cache.get(key);
    if (entry) return entry.dataUrl;

    // Also try localStorage
    try {
      const stored = localStorage.getItem(`tex:${key}`);
      if (stored) {
        this.cache.set(key, { dataUrl: stored, timestamp: 0 });
        return stored;
      }
    } catch { /* localStorage unavailable */ }

    return undefined;
  }

  /** Check if a texture is cached. */
  has(themeId: string, type: AssetType): boolean {
    return this.get(themeId, type) !== undefined;
  }

  /** Generate textures for a theme. Types: 'bg' | 'board' */
  async generateForTheme(
    themeId: string,
    types: AssetType[],
    onProgress?: ProgressCallback,
  ): Promise<void> {
    if (this.generating) return;
    this.generating = true;

    const prompts = THEME_PROMPTS[themeId];
    if (!prompts) {
      this.generating = false;
      return;
    }

    const total = types.length;
    onProgress?.({ status: 'generating', current: 0, total, label: '准备中...' });

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const promptText = prompts[type];
      const key = `${themeId}:${type}`;

      if (this.has(themeId, type)) {
        onProgress?.({ status: 'generating', current: i + 1, total, label: `${type} (已缓存)` });
        continue;
      }

      onProgress?.({ status: 'generating', current: i, total, label: `生成 ${type}...` });

      try {
        const size = type === 'bg' ? { w: 1280, h: 720 } : { w: 1024, h: 1024 };
        const params: GenParams = {
          prompt: promptText,
          width: size.w,
          height: size.h,
          seed: Math.floor(Math.random() * 1_000_000),
          steps: 20,
          guidance: 3.5,
        };

        const workflow = buildFluxWorkflow(params);
        const dataUrl = await generateImage(workflow);

        // Cache in memory and localStorage
        this.cache.set(key, { dataUrl, timestamp: Date.now() });
        try {
          localStorage.setItem(`tex:${key}`, dataUrl);
        } catch { /* quota exceeded, skip */ }

        onProgress?.({ status: 'generating', current: i + 1, total, label: `${type} ✓` });
      } catch (err: any) {
        onProgress?.({ status: 'error', current: i, total, label, error: err.message });
        this.generating = false;
        return;
      }
    }

    onProgress?.({ status: 'done', current: total, total, label: '完成' });
    this.generating = false;
  }

  /** Clear all cached textures. */
  clearCache(): void {
    this.cache.clear();
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('tex:')) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch { /* ok */ }
  }
}

/** Singleton texture manager. */
export const textureManager = new TextureManager();
