import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/ui-store';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: '亚马逊棋是什么？',
    icon: '🏛',
    content: (
      <div className="space-y-3">
        <p>亚马逊棋（Game of the Amazons）是一款<strong>两人抽象策略棋类</strong>游戏，1988 年由 Walter Zamkauskas 发明。</p>
        <p>双方各控制若干枚<strong>亚马逊战士</strong>（皇后走法），每回合先移动一枚棋子，再从新位置<strong>射出一支箭</strong>封锁一个格子。棋盘空间不断缩小，<strong>最后能移动的一方获胜</strong>。</p>
        <div className="flex items-center gap-4 justify-center py-2">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full" style={{ background: 'radial-gradient(circle, #fff, #ccc)', boxShadow: '0 0 12px #ffd700' }} />
            <span className="text-xs text-white/50">白方亚马逊</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full" style={{ background: 'radial-gradient(circle, #333, #000)', boxShadow: '0 0 12px #d4a017' }} />
            <span className="text-xs text-white/50">黑方亚马逊</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: '基本规则',
    icon: '📜',
    content: (
      <div className="space-y-3">
        <RuleItem num="1" title="白方先行">
          游戏开始时由白方先手，双方轮流操作。
        </RuleItem>
        <RuleItem num="2" title="移动亚马逊">
          选中己方一枚亚马逊，按照<strong>皇后走法</strong>（横、竖、斜任意格数）移动到空格。移动路径上不能有其他棋子或燃烧格。
        </RuleItem>
        <RuleItem num="3" title="射出箭矢">
          从亚马逊新位置，同样按皇后走法射出一支箭。箭的落点变为<strong>燃烧格 🔥</strong>，永久封锁，任何棋子都不能穿越或停留。
        </RuleItem>
        <RuleItem num="4" title="胜负判定">
          当一方<strong>无法进行合法移动</strong>时即告失败。注意：即使有亚马逊存活，只要所有亚马逊都被封锁无法移动，也算输。
        </RuleItem>
      </div>
    ),
  },
  {
    title: '操作指南',
    icon: '🖱',
    content: (
      <div className="space-y-3">
        <StepItem step="①" title="选择亚马逊" desc="点击己方亚马逊（当前回合颜色），棋子会出现高亮光环。" />
        <StepItem step="②" title="移动到目标" desc="点击一个合法目标格（高亮显示），亚马逊移动到该位置。" />
        <StepItem step="③" title="选择射箭目标" desc="从新位置再次点击一个合法格，箭矢射向该格并将其燃烧封锁。" />
        <StepItem step="④" title="回合结束" desc="自动切换到对手回合。观察 HUD 面板确认当前轮到谁。" />
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="text-xs text-white/40 mb-1">💡 提示</div>
          <ul className="text-xs text-white/60 space-y-1">
            <li>· 鼠标悬停在格子上可以看到高亮预览</li>
            <li>· 右侧面板可以查看完整走棋记录</li>
            <li>· 点击顶部主题按钮可以切换视觉风格</li>
            <li>· 点击认输按钮可以提前结束对局</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: '策略入门',
    icon: '🧠',
    content: (
      <div className="space-y-3">
        <StrategyItem title="控制中心" desc="尽量将亚马逊保持在棋盘中央区域，拥有更多移动选择。" />
        <StrategyItem title="区域封锁" desc="用箭矢将对手的亚马逊分割包围，限制其活动空间。" />
        <StrategyItem title="保持机动" desc="每步移动后确保亚马逊仍有足够的射箭和后续移动空间。" />
        <StrategyItem title="计算步数" desc="观察对手还有多少可用空间，预判 2-3 步后的局面。" />
        <StrategyItem title="终局意识" desc="当棋盘空间不足时，优先确保己方比对手多一口气。" />
      </div>
    ),
  },
];

function RuleItem({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: 'rgba(255,255,255,0.1)', color: '#f7c948' }}>
        {num}
      </div>
      <div>
        <div className="text-sm font-semibold text-white/80 mb-0.5">{title}</div>
        <div className="text-xs text-white/50 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function StepItem({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 text-lg">{step}</div>
      <div>
        <div className="text-sm font-semibold text-white/80">{title}</div>
        <div className="text-xs text-white/50">{desc}</div>
      </div>
    </div>
  );
}

function StrategyItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-sm font-semibold text-white/70 mb-1">{title}</div>
      <div className="text-xs text-white/40 leading-relaxed">{desc}</div>
    </div>
  );
}

export function Tutorial({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const theme = useUIStore(s => s.theme);
  const accentColor = '#' + theme.background.accent.toString(16).padStart(6, '0');

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex items-center justify-center p-8"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="w-full max-w-lg rounded-2xl border overflow-hidden"
            style={{
              background: 'rgba(10,10,20,0.95)',
              borderColor: `${accentColor}33`,
              boxShadow: `0 0 80px ${accentColor}11`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{current.icon}</span>
                <h2 className="text-lg font-bold text-white">{current.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 min-h-[220px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-white/60 text-sm leading-relaxed"
                >
                  {current.content}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
              {/* Step dots */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className="w-2 h-2 rounded-full transition-all duration-200"
                    style={{
                      background: i === step ? accentColor : 'rgba(255,255,255,0.15)',
                      transform: i === step ? 'scale(1.3)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {!isFirst && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-all"
                  >
                    ← 上一步
                  </button>
                )}
                {!isLast ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
                    }}
                  >
                    下一步 →
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
                    }}
                  >
                    开始游戏 ✓
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
