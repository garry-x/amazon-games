import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUIStore, ALL_THEMES } from '../store/ui-store';
import { ALL_VARIANTS } from '../store/game-store';
import { Tutorial } from './Tutorial';
import type { BoardSize, VariantConfig } from '../game/types';

interface Props {
  onStart: (variant: VariantConfig, boardSize: BoardSize) => void;
}

const BOARD_SIZES: { size: BoardSize; label: string; desc: string }[] = [
  { size: 6, label: '6×6', desc: '快节奏' },
  { size: 10, label: '10×10', desc: '经典体验' },
  { size: 14, label: '14×14', desc: '史诗对决' },
];

export function GameSetup({ onStart }: Props) {
  const { theme, setTheme } = useUIStore();
  const [variant, setVariant] = useState(ALL_VARIANTS[0]);
  const [size, setSize] = useState<BoardSize>(10);
  const [selTheme, setSelTheme] = useState(theme);
  const [showTutorial, setShowTutorial] = useState(false);

  const a = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const sfc = useMemo(() => '#' + theme.background.surface.toString(16).padStart(6, '0'), [theme]);

  const validSizes = BOARD_SIZES.filter(s => variant.recommendedSizes.includes(s.size));

  const start = () => { setTheme(selTheme); onStart(variant, size); };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-6 py-8 select-none">

      {/* Title section */}
      <motion.div
        initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="text-center mb-10">
        <h1 className="text-6xl font-extrabold tracking-tight mb-3"
          style={{ color: a, textShadow: `0 0 48px ${a}55, 0 4px 8px rgba(0,0,0,0.5)` }}>
          ⚔ 亚马逊棋
        </h1>
        <p className="text-base tracking-[0.3em] uppercase"
          style={{ color: a + '99' }}>
          Game of the Amazons
        </p>
      </motion.div>

      {/* Config panels */}
      <motion.div
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-3xl">

        {/* Mode + Size row */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Mode */}
          <Panel label="游戏模式" accent={a}>
            <div className="space-y-2">
              {ALL_VARIANTS.map(v => (
                <Option key={v.id}
                  selected={variant.id === v.id}
                  onClick={() => setVariant(v)}
                  accent={a}
                  title={v.name}
                  desc={v.description}
                  badge={`${v.amazonCount} 棋子 ×2`}
                />
              ))}
            </div>
          </Panel>

          {/* Board size */}
          <Panel label="棋盘规格" accent={a}>
            <div className="space-y-2">
              {validSizes.map(({ size: s, label, desc }) => (
                <Option key={s}
                  selected={size === s}
                  onClick={() => setSize(s)}
                  accent={a}
                  title={label}
                  desc={desc}
                />
              ))}
            </div>
          </Panel>
        </div>

        {/* Theme row */}
        <Panel label="视觉主题" accent={a}>
          <div className="grid grid-cols-4 gap-2">
            {ALL_THEMES.map(t => {
              const light = '#' + t.board.light.toString(16).padStart(6, '0');
              const dark = '#' + t.board.dark.toString(16).padStart(6, '0');
              const glow = '#' + t.pieces.whiteGlow.toString(16).padStart(6, '0');
              const active = selTheme.id === t.id;
              return (
                <motion.button key={t.id} onClick={() => setSelTheme(t)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="p-3 rounded-xl border-2 transition-colors duration-200 text-center"
                  style={{
                    borderColor: active ? a : 'rgba(255,255,255,0.08)',
                    background: active ? a + '10' : 'rgba(255,255,255,0.03)',
                  }}>
                  <div className="flex gap-1.5 justify-center mb-2">
                    <Swatch color={light} /><Swatch color={dark} /><Swatch color={glow} />
                  </div>
                  <div className="text-sm font-semibold text-white/85">{t.name}</div>
                  <div className="text-[11px] text-white/40 mt-0.5 leading-tight">{t.description}</div>
                </motion.button>
              );
            })}
          </div>
        </Panel>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <motion.button onClick={() => setShowTutorial(true)}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="px-6 py-3.5 rounded-xl text-base font-bold border transition-colors duration-200"
            style={{ color: a, borderColor: a + '44', background: a + '08' }}>
            📖 新手教程
          </motion.button>
          <motion.button onClick={start}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 rounded-xl text-xl font-extrabold transition-all duration-300"
            style={{
              color: '#0a0a10',
              background: `linear-gradient(135deg, ${a}, ${a}bb)`,
              boxShadow: `0 0 40px ${a}55, 0 8px 24px rgba(0,0,0,0.4)`,
            }}>
            开始游戏
          </motion.button>
        </div>
      </motion.div>

      <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
    </div>
  );
}

// ---- Sub-components ----

function Panel({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4"
      style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] mb-3"
        style={{ color: accent }}>
        {label}
      </h3>
      {children}
    </div>
  );
}

function Option({ selected, onClick, accent, title, desc, badge }: {
  selected: boolean; onClick: () => void; accent: string;
  title: string; desc: string; badge?: string;
}) {
  return (
    <motion.button onClick={onClick} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      className="w-full p-3 rounded-xl border-2 transition-colors duration-200 text-left flex items-center justify-between"
      style={{
        borderColor: selected ? accent : 'rgba(255,255,255,0.06)',
        background: selected ? accent + '0e' : 'rgba(255,255,255,0.02)',
      }}>
      <div>
        <div className="text-sm font-bold text-white/90">{title}</div>
        <div className="text-xs text-white/45 mt-0.5">{desc}</div>
      </div>
      {badge && (
        <span className="text-[10px] px-2 py-0.5 rounded-full text-white/35 border border-white/8">
          {badge}
        </span>
      )}
      {selected && (
        <div className="w-2 h-2 rounded-full flex-shrink-0 ml-2"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      )}
    </motion.button>
  );
}

function Swatch({ color }: { color: string }) {
  return <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/15" style={{ background: color }} />;
}
