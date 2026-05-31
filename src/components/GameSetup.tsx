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
  const { theme, setTheme } = useUIStore();
  const aiConfig = useGameStore(s => s.aiConfig);
  const setAIConfig = useGameStore(s => s.setAIConfig);
  const [variant, setVariant] = useState(ALL_VARIANTS[0]);
  const [size, setSize] = useState<BoardSize>(10);
  const [selTheme, setSelTheme] = useState(theme);
  const [showTutorial, setShowTutorial] = useState(false);

  const a = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const validSizes = BOARD_SIZES.filter(s => variant.recommendedSizes.includes(s.size));
  const start = () => { setTheme(selTheme); onStart(variant, size); };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-3 sm:px-6 py-3 sm:py-6 select-none overflow-y-auto">

      {/* Title */}
      <motion.div
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-1.5 sm:mb-2"
          style={{ color: a, textShadow: `0 0 40px ${a}44, 0 4px 8px rgba(0,0,0,0.5)` }}>
          ⚔ 亚马逊棋
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.25em] uppercase" style={{ color: a + '88' }}>
          Game of the Amazons
        </p>
      </motion.div>

      {/* Config */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="w-full max-w-2xl space-y-3">

        {/* Mode + Size in one row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border p-3 space-y-1.5"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: a }}>模式</div>
            {ALL_VARIANTS.map(v => (
              <motion.button key={v.id} onClick={() => setVariant(v)}
                whileTap={{ scale: 0.98 }}
                className="w-full p-2.5 rounded-lg text-left border transition-colors flex items-center gap-3"
                style={{
                  borderColor: variant.id === v.id ? a : 'rgba(255,255,255,0.06)',
                  background: variant.id === v.id ? a + '0d' : 'transparent',
                }}>
                <span className="text-lg">{v.id === 'classic' ? '🏛' : v.id === 'warlord' ? '⚡' : '🏰'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white/85">{v.name}</div>
                  <div className="text-[11px] text-white/40 truncate">{v.description}</div>
                </div>
                <span className="text-[10px] text-white/25 flex-shrink-0">{v.amazonCount}×2</span>
              </motion.button>
            ))}
          </div>

          <div className="rounded-xl border p-3 space-y-1.5"
            style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: a }}>棋盘</div>
            {validSizes.map(({ size: s, label, desc }) => (
              <motion.button key={s} onClick={() => setSize(s)}
                whileTap={{ scale: 0.98 }}
                className="w-full p-2.5 rounded-lg text-left border transition-colors"
                style={{
                  borderColor: size === s ? a : 'rgba(255,255,255,0.06)',
                  background: size === s ? a + '0d' : 'transparent',
                }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white/85">{label}</span>
                  <span className="text-[10px] text-white/35">{desc}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Themes — bigger cards with texture preview */}
        <div className="rounded-xl border p-3"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: a }}>主题</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ALL_THEMES.map(t => {
              const active = selTheme.id === t.id;
              return (
                <motion.button key={t.id} onClick={() => setSelTheme(t)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="rounded-xl border-2 overflow-hidden transition-colors"
                  style={{
                    borderColor: active ? a : 'rgba(255,255,255,0.06)',
                    background: active ? a + '0d' : 'rgba(255,255,255,0.02)',
                  }}>
                  {/* Mini texture preview */}
                  <div className="relative h-16 overflow-hidden">
                    <img src={`/textures/${t.id}-board.png`}
                      className="w-full h-full object-cover opacity-60"
                      alt="" loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute inset-0 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full ring-1 ring-white/20"
                        style={{ background: '#' + t.board.light.toString(16).padStart(6, '0') }} />
                      <div className="w-4 h-4 rounded-full ring-1 ring-white/20"
                        style={{ background: '#' + t.board.dark.toString(16).padStart(6, '0') }} />
                    </div>
                  </div>
                  <div className="p-2 text-center">
                    <div className="text-xs font-bold text-white/80">{t.name}</div>
                    <div className="text-[10px] text-white/35 mt-0.5 leading-tight truncate">{t.description}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* AI — collapsible */}
        <div className="rounded-xl border p-3"
          style={{ borderColor: aiConfig.enabled ? a + '44' : 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={aiConfig.enabled}
              onChange={e => setAIConfig({ enabled: e.target.checked })}
              className="w-4 h-4 rounded accent-[#d4a017]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: aiConfig.enabled ? a : 'rgba(255,255,255,0.5)' }}>
              🤖 AI 对战
            </span>
          </label>
          <AnimatePresence>
            {aiConfig.enabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-white/5">
                  <select value={aiConfig.aiPlayer}
                    onChange={e => setAIConfig({ aiPlayer: e.target.value as 'white' | 'black' })}
                    className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-white/70">
                    <option value="black">AI 执黑（你执白先手）</option>
                    <option value="white">AI 执白（你执黑后手）</option>
                  </select>
                  <div className="flex gap-1">
                    {AI_LEVELS.map(lv => (
                      <button key={lv.value} onClick={() => setAIConfig({ difficulty: lv.value })}
                        className="px-2.5 py-1 rounded text-[11px] font-medium border transition-colors"
                        style={{
                          borderColor: aiConfig.difficulty === lv.value ? a : 'rgba(255,255,255,0.1)',
                          color: aiConfig.difficulty === lv.value ? a : 'rgba(255,255,255,0.5)',
                          background: aiConfig.difficulty === lv.value ? a + '10' : 'transparent',
                        }}>
                        {lv.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Buttons */}
        <div className="flex gap-2.5 pt-1">
          <motion.button onClick={() => setShowTutorial(true)}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="px-4 py-3 rounded-xl text-sm font-bold border transition-colors"
            style={{ color: a, borderColor: a + '33', background: a + '06' }}>
            📖 教程
          </motion.button>
          <motion.button onClick={start}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3 rounded-xl text-lg font-extrabold transition-all"
            style={{
              color: '#0a0a10',
              background: `linear-gradient(135deg, ${a}, ${a}cc)`,
              boxShadow: `0 0 36px ${a}44, 0 6px 20px rgba(0,0,0,0.4)`,
            }}>
            开始游戏
          </motion.button>
        </div>
      </motion.div>

      <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}
