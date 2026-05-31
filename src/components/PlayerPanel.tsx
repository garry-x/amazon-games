import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';

// AI dialogue lines — randomly selected during AI turn
const AI_QUOTES = [
  '让我想想... 🤔',
  '这一步很有深意...',
  '你走得不赖嘛！',
  '我已经看穿你的策略了 😏',
  '嗯，这步值得斟酌...',
  '我的亚马逊战士无所畏惧！',
  '棋盘上的局势很有趣...',
  '你确定要这么走吗？',
  '我正在计算最佳路线...',
  '哈！这步妙极！',
  '冷静分析中... 🧠',
  '你的攻势需要更谨慎些',
  '看来你也是个高手',
  '这一箭会改变局面！',
  '让我仔细权衡一下...',
  '不错，但你低估了我',
  '棋逢对手，有趣有趣！',
  '我预判了你的预判 😎',
  '这游戏的深度令人着迷',
  '每一箭都是艺术 🎯',
];

function randomQuote(): string {
  return AI_QUOTES[Math.floor(Math.random() * AI_QUOTES.length)];
}

export function PlayerPanel() {
  const gameState = useGameStore(s => s.gameState);
  const aiConfig = useGameStore(s => s.aiConfig);
  const aiThinking = useGameStore(s => s.aiThinking);
  const theme = useUIStore(s => s.theme);
  const [quote, setQuote] = useState<string | null>(null);
  const [quoteTimer, setQuoteTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  const accent = useMemo(() => '#' + theme.background.accent.toString(16).padStart(6, '0'), [theme]);
  const whiteAvatar = `/avatars/${theme.id}-white.webp`;
  const blackAvatar = `/avatars/${theme.id}-black.webp`;

  // Show random quote when AI is thinking
  useEffect(() => {
    if (aiThinking) {
      setQuote(randomQuote());
      const timer = setInterval(() => setQuote(randomQuote()), 4000);
      setQuoteTimer(timer);
      return () => clearInterval(timer);
    } else {
      setQuote(null);
      if (quoteTimer) clearInterval(quoteTimer);
    }
  }, [aiThinking]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gameState || gameState.phase !== 'playing') return null;

  const current = gameState.currentPlayer;
  const isAI = aiConfig.enabled;
  const blackIsAI = isAI && aiConfig.aiPlayer === 'black';
  const whiteIsAI = isAI && aiConfig.aiPlayer === 'white';

  return (
    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none z-10">
      {/* White player */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-colors"
            style={{
              borderColor: current === 'white' ? accent : 'rgba(255,255,255,0.15)',
              boxShadow: current === 'white' ? `0 0 20px ${accent}44` : 'none',
            }}>
            <img src={whiteAvatar} className="w-full h-full object-cover" alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          {current === 'white' && (
            <motion.div className="absolute -top-1 -right-1 w-4 h-4 rounded-full"
              style={{ background: accent }}
              animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          )}
        </div>
        <div className="text-xs text-white/50 font-medium">
          {whiteIsAI ? '🤖 AI' : '玩家'}（白）
        </div>
      </div>

      {/* AI dialogue bubble */}
      <AnimatePresence>
        {quote && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm text-white/80 whitespace-nowrap pointer-events-none"
            style={{
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${accent}33`,
            }}>
            {quote}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Black player */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-colors"
            style={{
              borderColor: current === 'black' ? accent : 'rgba(255,255,255,0.15)',
              boxShadow: current === 'black' ? `0 0 20px ${accent}44` : 'none',
            }}>
            <img src={blackAvatar} className="w-full h-full object-cover" alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          {current === 'black' && (
            <motion.div className="absolute -top-1 -right-1 w-4 h-4 rounded-full"
              style={{ background: accent }}
              animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          )}
        </div>
        <div className="text-xs text-white/50 font-medium">
          {blackIsAI ? '🤖 AI' : '玩家'}（黑）
        </div>
      </div>
    </div>
  );
}
