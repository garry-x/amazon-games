import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, ALL_THEMES } from '../store/ui-store';
import { ALL_VARIANTS } from '../store/game-store';
import { Tutorial } from './Tutorial';
import type { BoardSize, VariantConfig } from '../game/types';
import type { Theme } from '../themes/types';

interface Props {
  onStart: (variant: VariantConfig, boardSize: BoardSize) => void;
}

const BOARD_SIZES: { size: BoardSize; label: string; desc: string }[] = [
  { size: 6, label: '小型 6×6', desc: '快节奏' },
  { size: 10, label: '标准 10×10', desc: '经典体验' },
  { size: 14, label: '大型 14×14', desc: '史诗对决' },
];

export function GameSetup({ onStart }: Props) {
  const { theme, setTheme } = useUIStore();
  const [selectedVariant, setSelectedVariant] = useState(ALL_VARIANTS[0]);
  const [selectedSize, setSelectedSize] = useState<BoardSize>(10);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [showTutorial, setShowTutorial] = useState(false);

  const accentColor = '#' + theme.background.accent.toString(16).padStart(6, '0');

  const validSizes = BOARD_SIZES.filter(s =>
    selectedVariant.recommendedSizes.includes(s.size)
  );

  const handleStart = () => {
    setTheme(selectedTheme);
    onStart(selectedVariant, selectedSize);
  };

  return (
    <motion.div
      className="max-w-2xl w-full mx-4 p-8 rounded-2xl border border-white/10"
      style={{
        background: 'rgba(10,10,20,0.85)',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 0 60px ${accentColor}22, 0 20px 60px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Title */}
      <div className="text-center mb-8">
        <motion.h1
          className="text-5xl font-bold mb-2 tracking-wider"
          style={{
            color: accentColor,
            textShadow: `0 0 30px ${accentColor}66`,
          }}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          ⚔ 亚马逊棋
        </motion.h1>
        <p className="text-white/40 text-sm font-mono">Game of the Amazons</p>
      </div>

      {/* Variant selection */}
      <Section title="游戏模式">
        <div className="grid grid-cols-3 gap-3">
          {ALL_VARIANTS.map((variant) => (
            <SelectCard
              key={variant.id}
              selected={selectedVariant.id === variant.id}
              onClick={() => setSelectedVariant(variant)}
              accent={accentColor}
            >
              <div className="text-lg font-bold mb-1">{variant.name}</div>
              <div className="text-xs text-white/50">{variant.description}</div>
              <div className="text-xs mt-2 text-white/30">
                {variant.amazonCount} 棋子 × 2
              </div>
            </SelectCard>
          ))}
        </div>
      </Section>

      {/* Board size */}
      <Section title="棋盘规格">
        <div className="flex gap-3">
          {validSizes.map(({ size, label, desc }) => (
            <SelectCard
              key={size}
              selected={selectedSize === size}
              onClick={() => setSelectedSize(size)}
              accent={accentColor}
            >
              <div className="text-lg font-bold mb-1">{label}</div>
              <div className="text-xs text-white/50">{desc}</div>
            </SelectCard>
          ))}
        </div>
      </Section>

      {/* Theme selection */}
      <Section title="视觉主题">
        <div className="grid grid-cols-4 gap-3">
          {ALL_THEMES.map((t) => (
            <motion.button
              key={t.id}
              onClick={() => setSelectedTheme(t)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-3 rounded-xl border-2 transition-all duration-200 text-center"
              style={{
                borderColor: selectedTheme.id === t.id ? accentColor : 'rgba(255,255,255,0.08)',
                background: selectedTheme.id === t.id
                  ? `${accentColor}15`
                  : 'rgba(255,255,255,0.03)',
              }}
            >
              {/* Theme color preview */}
              <div className="flex gap-1 justify-center mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: '#' + t.board.light.toString(16).padStart(6, '0') }}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: '#' + t.board.dark.toString(16).padStart(6, '0') }}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: '#' + t.pieces.whiteGlow.toString(16).padStart(6, '0') }}
                />
              </div>
              <div className="text-sm font-medium text-white/80">{t.name}</div>
              <div className="text-xs text-white/40 mt-0.5">{t.description}</div>
            </motion.button>
          ))}
        </div>
      </Section>

      {/* Start button */}
      <div className="flex gap-3">
        <motion.button
          onClick={() => setShowTutorial(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-4 rounded-xl text-lg font-bold text-white transition-all duration-300
            border border-white/10 hover:border-white/30"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          📖 新手教程
        </motion.button>
        <motion.button
          onClick={handleStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 py-4 rounded-xl text-xl font-bold text-white transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
            boxShadow: `0 0 30px ${accentColor}44`,
          }}
        >
          开始游戏
        </motion.button>
      </div>

      {/* Tutorial dialog */}
      <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SelectCard({
  selected,
  onClick,
  accent,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="relative p-4 rounded-xl border-2 transition-all duration-200 text-left"
      style={{
        borderColor: selected ? accent : 'rgba(255,255,255,0.08)',
        background: selected ? `${accent}12` : 'rgba(255,255,255,0.03)',
      }}
    >
      {selected && (
        <motion.div
          layoutId="selectedIndicator"
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
        />
      )}
      {children}
    </motion.button>
  );
}
