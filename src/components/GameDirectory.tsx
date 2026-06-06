import { motion } from 'framer-motion';
import { useUIStore } from '../store/ui-store';
import { useMemo } from 'react';

export interface GameMeta {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const GAMES: GameMeta[] = [
  {
    id: 'amazon',
    name: '亚马逊棋',
    emoji: '⚔',
    description: 'Game of the Amazons — 皇后走法策略对弈，移动棋子并射箭封锁对手',
  },
];

interface Props {
  onSelect: (game: GameMeta) => void;
}

export function GameDirectory({ onSelect }: Props) {
  const previewTheme = useUIStore(s => s.previewTheme);
  const accent = useMemo(() => '#' + previewTheme.background.accent.toString(16).padStart(6, '0'), [previewTheme]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-start sm:justify-center px-3 sm:px-6 py-5 sm:py-8 select-none overflow-y-auto overflow-x-hidden">
      {/* Title */}
      <motion.div
        initial={false}
        className="text-center mb-6 sm:mb-10 px-2">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-2"
          style={{ color: accent, textShadow: `0 0 40px ${accent}44, 0 4px 10px rgba(0,0,0,0.6)` }}>
          Math Games
        </h1>
        <p className="text-xs sm:text-sm tracking-[0.2em] uppercase" style={{ color: accent + '88' }}>
          数学策略游戏合集
        </p>
      </motion.div>

      {/* Game Cards */}
      <motion.div
        initial={false}
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl space-y-3 sm:space-y-4">
        {GAMES.map((game, i) => (
          <motion.button
            key={game.id}
            onClick={() => onSelect(game)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full p-4 sm:p-5 rounded-2xl border text-left transition-all flex items-center gap-4 sm:gap-5"
            style={{
              borderColor: accent + '33',
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(12px)',
            }}>
            <span className="text-3xl sm:text-4xl flex-shrink-0">{game.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg font-bold text-white/90">{game.name}</div>
              <div className="text-xs sm:text-sm text-white/40 mt-1 leading-snug">{game.description}</div>
            </div>
            <span className="text-white/20 text-lg flex-shrink-0">→</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Android APK Download */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl mt-6 sm:mt-8">
        <a
          href="/math-games.apk"
          download
          className="w-full p-4 sm:p-5 rounded-2xl border text-left transition-all flex items-center gap-4 sm:gap-5 block"
          style={{
            borderColor: accent + '22',
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(12px)',
          }}>
          <span className="text-3xl sm:text-4xl flex-shrink-0">📱</span>
          <div className="flex-1 min-w-0">
            <div className="text-base sm:text-lg font-bold text-white/80">Android APK 下载</div>
            <div className="text-xs sm:text-sm text-white/35 mt-1 leading-snug">
              支持鸿蒙 OS 4.2.0+ · 局域网连接桌面服务器
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
            style={{ color: accent, borderColor: accent + '44', border: '1px solid ' + accent + '33', background: accent + '0d' }}>
            ↓ 下载
          </span>
        </a>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 text-xs text-white/20">
        更多游戏即将推出 · More games coming soon
      </motion.p>
    </div>
  );
}
