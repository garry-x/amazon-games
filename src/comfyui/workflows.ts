/**
 * Flux.1 Dev workflow builders for themed asset generation.
 *
 * Node reference (IDs used in the JSON):
 *   1  — DualCLIPLoader      (clip_l + t5xxl, type=flux)
 *   4  — UNETLoader           (flux1-dev.safetensors, fp8_e4m3fn)
 *   5  — VAELoader             (ae.safetensors)
 *   6  — CLIPTextEncodeFlux    (prompt → CONDITIONING)
 *   7  — EmptyFlux2LatentImage (width, height)
 *   8  — ModelSamplingFlux     (max_shift, base_shift)
 *   9  — RandomNoise           (seed)
 *  10  — BasicScheduler        (model, scheduler, steps, denoise)
 *  11  — KSamplerSelect        (sampler_name)
 *  12  — FluxGuidance          (conditioning, guidance) → CONDITIONING
 *  13  — BasicGuider           (model, conditioning) → GUIDER
 *  14  — SamplerCustomAdvanced (noise, guider, sampler, sigmas, latent)
 *  15  — VAEDecode             (samples, vae)
 *  16  — PreviewImage          (images)
 */

export interface GenParams {
  prompt: string;
  width: number;
  height: number;
  seed: number;
  steps?: number;
  guidance?: number;
}

/** Build a Flux.1 Dev txt2img workflow. */
export function buildFluxWorkflow(p: GenParams): Record<string, unknown> {
  const steps = p.steps ?? 20;
  const guidance = p.guidance ?? 3.5;

  return {
    '1': {
      inputs: {
        clip_name1: 'clip_l.safetensors',
        clip_name2: 't5xxl_fp16.safetensors',
        type: 'flux',
      },
      class_type: 'DualCLIPLoader',
    },
    '4': {
      inputs: {
        unet_name: 'flux1-dev.safetensors',
        weight_dtype: 'fp8_e4m3fn',
      },
      class_type: 'UNETLoader',
    },
    '5': {
      inputs: { vae_name: 'ae.safetensors' },
      class_type: 'VAELoader',
    },
    '6': {
      inputs: {
        clip: ['1', 0],
        clip_l: p.prompt,
        t5xxl: p.prompt,
        guidance,
      },
      class_type: 'CLIPTextEncodeFlux',
    },
    '7': {
      inputs: { width: p.width, height: p.height, batch_size: 1 },
      class_type: 'EmptyFlux2LatentImage',
    },
    '8': {
      inputs: {
        model: ['4', 0],
        max_shift: 1.15,
        base_shift: 0.5,
        width: p.width,
        height: p.height,
      },
      class_type: 'ModelSamplingFlux',
    },
    '9': {
      inputs: { noise_seed: p.seed },
      class_type: 'RandomNoise',
    },
    '10': {
      inputs: {
        model: ['8', 0],
        scheduler: 'simple',
        steps,
        denoise: 1,
      },
      class_type: 'BasicScheduler',
    },
    '11': {
      inputs: { sampler_name: 'euler' },
      class_type: 'KSamplerSelect',
    },
    '12': {
      inputs: {
        conditioning: ['6', 0],
        guidance,
      },
      class_type: 'FluxGuidance',
    },
    '13': {
      inputs: {
        model: ['8', 0],
        conditioning: ['12', 0],
      },
      class_type: 'BasicGuider',
    },
    '14': {
      inputs: {
        noise: ['9', 0],
        guider: ['13', 0],
        sampler: ['11', 0],
        sigmas: ['10', 0],
        latent_image: ['7', 0],
      },
      class_type: 'SamplerCustomAdvanced',
    },
    '15': {
      inputs: {
        samples: ['14', 0],
        vae: ['5', 0],
      },
      class_type: 'VAEDecode',
    },
    '16': {
      inputs: { images: ['15', 0] },
      class_type: 'PreviewImage',
    },
  };
}

// ========== Prompt templates per theme ==========

interface ThemePrompt {
  bg: string;     // background
  board: string;  // board texture
  piece: string;  // piece style
}

export const THEME_PROMPTS: Record<string, ThemePrompt> = {
  egyptian: {
    bg: 'Ancient Egyptian temple interior, golden sandstone walls with hieroglyphic carvings, warm torchlight, ornate pillars, mystical atmosphere, cinematic lighting, 8k',
    board: 'Ornate Egyptian game board made of gold-inlaid sandstone and lapis lazuli tiles, square grid pattern, ancient craftsmanship, hieroglyphic border decorations, warm golden light, top-down view, tile texture',
    piece: 'Ancient Egyptian queen chess piece carved from ivory and obsidian, gold crown with lapis lazuli gems, ornate details, museum quality, isolated on transparent background, product photography',
  },
  medieval: {
    bg: 'Medieval castle great hall, stone walls with banners, large fireplace with warm fire, oak table, suits of armor, candlelit atmosphere, cinematic, 8k',
    board: 'Medieval game board made of oak and walnut wood inlay, square checker pattern, iron rivets on corners, castle stone border, warm firelight, top-down view, tile texture',
    piece: 'Medieval queen chess piece carved from marble and dark oak, iron crown with emerald gems, castle forge craftsmanship, isolated on transparent background, product photography',
  },
  scifi: {
    bg: 'Futuristic cyberpunk control room, holographic displays, neon blue and pink lighting, chrome surfaces, circuit patterns, data streams, Blade Runner aesthetic, cinematic, 8k',
    board: 'Holographic game grid floating above a chrome table, neon edge lights, circuit trace patterns in squares, glowing blue grid lines, dark metal surface, top-down view, cyberpunk tile texture',
    piece: 'Futuristic holographic queen game piece made of white crystal and dark chrome, neon crown with glowing cyan accents, sci-fi craftsmanship, isolated on black background, product photography',
  },
  nature: {
    bg: 'Enchanted forest glade, ancient moss-covered stones, magical glowing plants, sunbeams through emerald canopy, fairy lights, ethereal atmosphere, cinematic, 8k',
    board: 'Natural stone and moss game board, carved stone tiles with vine patterns between squares, forest floor aesthetic, dappled sunlight, top-down view, organic tile texture',
    piece: 'Forest spirit queen game piece carved from white birch wood and dark walnut, crown of woven vines with emerald glow, elven craftsmanship, isolated on natural background, product photography',
  },
};
