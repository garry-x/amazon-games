import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, ALL_THEMES } from '../store/ui-store';
import { ALL_VARIANTS, useGameStore } from '../store/game-store';
import type { AIDifficulty } from '../ai/engine';
import { Tutorial } from './Tutorial';
import type { BoardSize, VariantConfig } from '../game/types';

interface Props {
  onStart: (variant: VariantConfig, boardSize: BoardSize) => void;
}

const BOARD_SIZES: { size: BoardSize; label: string; desc: string }[] = [
  { size: 6, label: '6×6', desc: '快节奏' },
  { size: 10, label: '10×10', desc: '经典' },
  { size: 14, label: '14×14', desc: '史诗' },
];

const AI_LEVELS: { value: AIDifficulty; label: string; desc: string }[] = [
  { value: 'easy', label: '初级', desc: '休闲' },
  { value: 'medium', label: '中级', desc: '均衡' },
  { value: 'hard', label: '高级', desc: '深度' },
];

export function GameSetup({ onStart }: Props) {
  const { previewTheme, setPreviewTheme, setTheme } = useUIStore();
  const aiConfig = useGameStore(s => s.aiConfig);
  const setAIConfig = useGameStore(s => s.setAIConfig);
  const [variant, setVariant] = useState(ALL_VARIANTS[0]);
  const [size, setSize] = useState<BoardSize>(10);
  const [showTutorial, setShowTutorial] = useState(false);

  const a = useMemo(() => '#' + previewTheme.background.accent.toString(16).padStart(6, '0'), [previewTheme]);
  const validSizes = BOARD_SIZES.filter(s => variant.recommendedSizes.includes(s.size));
  const start = () => { setTheme(previewTheme); onStart(variant, size); };

  const section = "rounded-2xl border p-4 sm:p-5";
  const sectionLabel = "text-xs font-bold uppercase tracking-[0.1em] mb-3";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 sm:px-6 py-4 sm:py-8 select-none overflow-y-auto">

      {/* Title */}
      <motion.div
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-2"
          style={{ color: a, textShadow: `0 0 40px ${a}44, 0 4px 10px rgba(0,0,0,0.6)` }}>
          ⚔ 亚马逊棋
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.2em] uppercase" style={{ color: a + '88' }}>
          Game of the Amazons
        </p>
      </motion.div>

      {/* Config */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="w-full max-w-2xl space-y-4">

        {/* Mode + Size */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={section} style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div className={sectionLabel} style={{ color: a }}>游戏模式</div>
            <div className="space-y-2">
              {ALL_VARIANTS.map(v => (
                <motion.button key={v.id} onClick={() => setVariant(v)} whileTap={{ scale: 0.98 }}
                  className="w-full p-3 rounded-xl text-left border transition-colors flex items-center gap-3"
                  style={{
                    borderColor: variant.id === v.id ? a : 'rgba(255,255,255,0.06)',
                    background: variant.id === v.id ? a + '0d' : 'transparent',
                  }}>
                  <span className="text-xl">{v.id === 'classic' ? '🏛' : v.id === 'warlord' ? '⚡' : '🏰'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white/90">{v.name}</div>
                    <div className="text-xs text-white/45 mt-0.5 truncate">{v.description}</div>
                  </div>
                  <span className="text-[11px] font-medium text-white/30 flex-shrink-0 bg-white/5 px-2 py-0.5 rounded-full">{v.amazonCount}×2</span>
                </motion.button>
              ))}
            </div>
          </div>

          <div className={section} style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div className={sectionLabel} style={{ color: a }}>棋盘规格</div>
            <div className="space-y-2">
              {validSizes.map(({ size: s, label, desc }) => (
                <motion.button key={s} onClick={() => setSize(s)} whileTap={{ scale: 0.98 }}
                  className="w-full p-3 rounded-xl text-left border transition-colors flex items-center justify-between"
                  style={{
                    borderColor: size === s ? a : 'rgba(255,255,255,0.06)',
                    background: size === s ? a + '0d' : 'transparent',
                  }}>
                  <span className="text-sm font-bold text-white/90">{label}</span>
                  <span className="text-xs text-white/40">{desc}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Themes */}
        <div className={section} style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div className={sectionLabel} style={{ color: a }}>视觉主题</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ALL_THEMES.map(t => {
              const active = previewTheme.id === t.id;
              return (
                <motion.button key={t.id} onClick={() => setPreviewTheme(t)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="rounded-xl border-2 overflow-hidden transition-colors"
                  style={{
                    borderColor: active ? a : 'rgba(255,255,255,0.06)',
                    background: active ? a + '0d' : 'rgba(255,255,255,0.02)',
                  }}>
                  <div className="relative h-20 overflow-hidden">
                    <img src={`/textures/${t.id}-board.png`}
                      className="w-full h-full object-cover opacity-70" alt="" loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="p-2.5 text-center">
                    <div className="text-sm font-bold text-white/85">{t.name}</div>
                    <div className="text-[11px] text-white/40 mt-0.5 leading-tight">{t.description}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* AI */}
        <div className={section}
          style={{ borderColor: aiConfig.enabled ? a + '55' : 'rgba(255,255,255,0.07)', background: aiConfig.enabled ? a + '08' : 'rgba(255,255,255,0.02)' }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative flex-shrink-0">
              <input type="checkbox" checked={aiConfig.enabled}
                onChange={e => setAIConfig({ enabled: e.target.checked })} className="sr-only" />
              <div className="w-12 h-7 rounded-full transition-colors relative"
                style={{ background: aiConfig.enabled ? a : 'rgba(255,255,255,0.12)' }}>
                <div className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
                  style={{ transform: aiConfig.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: aiConfig.enabled ? a : 'rgba(255,255,255,0.55)' }}>
                🤖 AI 对战
              </div>
              <div className="text-xs text-white/30 mt-0.5">本地大模型 Qwen 35B 智能对手</div>
            </div>
          </label>

          <AnimatePresence>
            {aiConfig.enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                  <div>
                    <div className="text-xs text-white/35 font-medium mb-2">AI 执棋方</div>
                    <div className="flex gap-2">
                      {(['black', 'white'] as const).map(side => (
                        <button key={side} onClick={() => setAIConfig({ aiPlayer: side })}
                          className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors"
                          style={{
                            borderColor: aiConfig.aiPlayer === side ? a : 'rgba(255,255,255,0.1)',
                            color: aiConfig.aiPlayer === side ? a : 'rgba(255,255,255,0.55)',
                            background: aiConfig.aiPlayer === side ? a + '10' : 'rgba(255,255,255,0.02)',
                          }}>
                          {side === 'black' ? 'AI 执黑' : 'AI 执白'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-white/35 font-medium mb-2">难度等级</div>
                    <div className="grid grid-cols-3 gap-2">
                      {AI_LEVELS.map(lv => {
                        const sel = aiConfig.difficulty === lv.value;
                        return (
                          <button key={lv.value} onClick={() => setAIConfig({ difficulty: lv.value })}
                            className="py-3 rounded-lg text-sm font-bold border-2 transition-all"
                            style={{
                              borderColor: sel ? a : 'rgba(255,255,255,0.08)',
                              color: sel ? a : 'rgba(255,255,255,0.5)',
                              background: sel ? a + '0e' : 'rgba(255,255,255,0.02)',
                              boxShadow: sel ? `0 0 18px ${a}22` : 'none',
                            }}>
                            {lv.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <motion.button onClick={() => setShowTutorial(true)}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="px-5 py-3.5 rounded-xl text-sm font-bold border transition-colors"
            style={{ color: a, borderColor: a + '33', background: a + '06' }}>
            📖 教程
          </motion.button>
          <motion.button onClick={start}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 rounded-xl text-xl font-black transition-all tracking-wide"
            style={{
              color: '#0a0a10',
              background: `linear-gradient(135deg, ${a}, ${a}cc)`,
              boxShadow: `0 0 40px ${a}44, 0 8px 24px rgba(0,0,0,0.5)`,
            }}>
            开始游戏
          </motion.button>
        </div>
      </motion.div>

      <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}
