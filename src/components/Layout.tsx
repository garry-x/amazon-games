import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/ui-store';
import { useGameStore } from '../store/game-store';
import { GameSetup } from './GameSetup';
import { GameBoard } from './GameBoard';
import { GameHUD } from './GameHUD';
import { MoveHistory } from './MoveHistory';
import { ThemePicker } from './ThemePicker';
import { ResultDialog } from './ResultDialog';
import { Tutorial } from './Tutorial';
import { useState, useMemo } from 'react';
import type { BoardSize, VariantConfig } from '../game/types';

// Stable particle configs (no Math.random in render)
const PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: ((i * 137 + 41) % 100),
  y: ((i * 251 + 73) % 100),
  size: 1.5 + (i % 5) * 0.7,
  dur: 3 + (i % 7),
  delay: (i * 0.7) % 5,
}));

export function Layout() {
  const { showSetup, setShowSetup } = useUIStore();
  const { gameState, startGame } = useGameStore();
  const theme = useUIStore(s => s.theme);
  const previewTheme = useUIStore(s => s.previewTheme);
  const [showHistory, setShowHistory] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const isPlaying = gameState && gameState.phase !== 'finished';
  // Use preview theme for background when on setup screen
  const activeTheme = showSetup ? previewTheme : theme;
  const accent = useMemo(() => '#' + activeTheme.background.accent.toString(16).padStart(6, '0'), [activeTheme]);
  const bg1 = useMemo(() => '#' + activeTheme.background.primary.toString(16).padStart(6, '0'), [activeTheme]);
  const bg2 = useMemo(() => '#' + activeTheme.background.secondary.toString(16).padStart(6, '0'), [activeTheme]);

  const handleStart = (v: VariantConfig, s: BoardSize) => { startGame(v, s); setShowSetup(false); };

  return (
    <div className="h-full flex flex-col relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 35%, ${bg2} 0%, ${bg1} 60%, #030308 100%)` }}>

      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {PARTICLES.map(p => (
          <motion.div key={p.id} className="absolute rounded-full"
            style={{
              background: accent,
              width: p.size, height: p.size,
              left: `${p.x}%`, top: `${p.y}%`,
            }}
            animate={{ y: [0, -50, 0], opacity: [0.06, 0.2, 0.06] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Top bar */}
      {isPlaying && (
        <motion.div
          initial={{ y: -64 }} animate={{ y: 0 }}
          className="relative z-10 flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b"
          style={{
            borderColor: accent + '22',
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(16px)',
            paddingTop: 'env(safe-area-inset-top, 8px)',
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-base sm:text-xl font-bold tracking-wider"
              style={{ color: accent, textShadow: `0 0 16px ${accent}44` }}>
              ⚔ 亚马逊棋
            </h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <TopBtn onClick={() => setShowTutorial(true)}>📖</TopBtn>
            <ThemePicker />
            <TopBtn onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? '📋' : '📋'}
            </TopBtn>
            <TopBtn onClick={() => setShowSetup(true)}>⚙</TopBtn>
          </div>
        </motion.div>
      )}

      {/* Main */}
      <div className="flex-1 flex relative overflow-hidden">
        <AnimatePresence>
          {showSetup && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className="absolute inset-0 z-20">
              <GameSetup onStart={handleStart} />
            </motion.div>
          )}
        </AnimatePresence>

        {!showSetup && gameState && (
          <div className="flex-1 flex relative">
            <div className="flex-1 relative">
              <GameBoard />
              <div className="absolute top-4 left-4 z-10"><GameHUD /></div>
            </div>
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-l overflow-hidden"
                  style={{ borderColor: accent + '18', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}
                >
                  <MoveHistory />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {gameState?.phase === 'finished' && <ResultDialog />}
        </AnimatePresence>

        <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} />
      </div>
    </div>
  );
}

function TopBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
        border hover:border-white/20 text-white/55 hover:text-white/85"
      style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
      {children}
    </button>
  );
}
