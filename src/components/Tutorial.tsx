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
          当一方<strong>无法进行合法移动</strong>时即告失败。双方均无法移动时判定为<strong>平局 🤝</strong>。
        </RuleItem>
      </div>
    ),
  },
  {
    title: '操作指南',
    icon: '🖱',
    content: (
      <div className="space-y-3">
        <StepItem step="①" title="选择亚马逊" desc="点击己方亚马逊，棋子高亮并显示所有合法移动目标（绿色圆点）。" />
        <StepItem step="②" title="移动到目标" desc="点击一个合法目标格，亚马逊滑动到该位置，进入射箭阶段。" />
        <StepItem step="③" title="射箭 🔥" desc="点击合法射箭目标，箭矢飞行动画 + 命中冲击波 + 燃烧坑洞 + 持续火焰。" />
        <StepItem step="④" title="回合结束" desc="自动切换对手。左侧 HUD 面板显示当前回合和步数统计。" />
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="text-xs text-white/40 mb-1">💡 实用提示</div>
          <ul className="text-xs text-white/60 space-y-1">
            <li>· 鼠标悬停高亮预览 · 右侧面板查看走棋记录</li>
            <li>· 顶部切换主题 (4套) · 点击认输提前结束</li>
            <li>· iPad/平板支持触摸操作和 PWA 全屏模式</li>
            <li>· HUD 面板点击 − 可折叠为紧凑模式</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'AI 对战',
    icon: '🤖',
    content: (
      <div className="space-y-3">
        <p>首页设置面板可以启用<strong> AI 对战模式</strong>，使用本地大模型 Qwen 35B 作为对手。</p>
        <RuleItem num="1" title="启用 AI">
          在首页勾选「🤖 AI 对战」开关，选择 AI 执黑或执白。
        </RuleItem>
        <RuleItem num="2" title="难度选择">
          提供<strong>初级 / 中级 / 高级</strong>三档难度。高级模式 AI 会进行 3-4 步深度分析。
        </RuleItem>
        <RuleItem num="3" title="AI 思考">
          AI 回合时 HUD 显示旋转加载动画「AI 思考中...」，期间棋盘不可操作。AI 走棋分三步渲染：选中 → 移动 → 射箭。
        </RuleItem>
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="text-xs text-white/40 mb-1">⚙ 前提</div>
          <p className="text-xs text-white/50">需要本地运行 vLLM 服务 (http://127.0.0.1:8000/v1)，模型为 Qwen3.6-35B。AI 不可用时自动降级为随机走棋。</p>
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
