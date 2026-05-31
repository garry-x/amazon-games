import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { textureManager, type GenerationProgress } from '../comfyui/texture-manager';
import { useUIStore } from '../store/ui-store';

interface Props {
  /** Callback when a background texture is generated or cleared. */
  onBackgroundChange: (dataUrl: string | undefined) => void;
}

export function TextureGenerator({ onBackgroundChange }: Props) {
  const theme = useUIStore(s => s.theme);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [hasBg, setHasBg] = useState(false);
  const running = useRef(false);

  // Check if bg already cached on theme change
  useEffect(() => {
    setHasBg(textureManager.has(theme.id, 'bg'));
  }, [theme.id]);

  const accent = '#' + theme.background.accent.toString(16).padStart(6, '0');

  const generate = useCallback(async () => {
    if (running.current) return;
    running.current = true;

    await textureManager.generateForTheme(theme.id, ['bg'], (p) => {
      setProgress({ ...p });
      if (p.status === 'done') {
        const url = textureManager.get(theme.id, 'bg');
        onBackgroundChange(url);
        setHasBg(true);
      }
    });

    running.current = false;
  }, [theme.id, onBackgroundChange]);

  const clear = useCallback(() => {
    textureManager.clearCache();
    onBackgroundChange(undefined);
    setHasBg(false);
    setProgress(null);
  }, [onBackgroundChange]);

  const isGenerating = progress?.status === 'generating';

  return (
    <div className="flex items-center gap-2">
      <motion.button
        onClick={generate}
        disabled={isGenerating}
        whileHover={!isGenerating ? { scale: 1.03 } : {}}
        whileTap={!isGenerating ? { scale: 0.97 } : {}}
        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
          border disabled:opacity-50"
        style={{
          borderColor: accent + '44',
          color: accent,
          background: accent + '0d',
        }}>
        {isGenerating ? '⏳ ' + progress?.label : (hasBg ? '🔄 重新生成' : '✨ AI 生成背景')}
      </motion.button>

      {hasBg && !isGenerating && (
        <button onClick={clear}
          className="px-2 py-1 rounded-lg text-[10px] text-white/30 hover:text-red-400/70 transition-colors">
          清除
        </button>
      )}

      {/* Progress bar */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ width: 0, opacity: 0 }} animate={{ width: 80, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: accent }}
              animate={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
