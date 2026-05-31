# ⚔ 亚马逊棋 — Game of the Amazons

> 支持多种变体与棋盘规格的亚马逊棋，华丽浏览器双人对弈

亚马逊棋（Game of the Amazons）是一款两人抽象策略棋类游戏，由 Walter Zamkauskas 于 1988 年发明。每回合玩家移动一枚亚马逊棋子（皇后走法），然后射出一支箭封锁棋盘格子，最后能移动的一方获胜。

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-8-646cff?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/PixiJS-8-f02854" alt="PixiJS">
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind">
</p>

---

## 特性

- **3 种棋盘规格** — 小型 6×6 / 标准 10×10 / 大型 14×14
- **3 种规则变体**
  - 🏛 经典模式 — 每方 4 枚亚马逊，四角对称开局
  - ⚡ 军阀对决 — 每方 2 枚亚马逊，快节奏对抗
  - 🏰 围城之战 — 每方 6 枚亚马逊，史诗级大场面
- **4 种视觉主题**
  - 🏜 古埃及 — 尼罗河畔的金色沙漠
  - 🛡 中世纪 — 城堡大厅中的王座对决
  - 🌐 科幻纪元 — 霓虹闪烁的赛博空间
  - 🌿 自然之息 — 翡翠森林中的精灵棋局
- **WebGL 渲染** — PixiJS 驱动，棋子辉光、箭矢拖尾、燃烧特效
- **热座双人** — 两人在同一设备轮流操作
- **走棋记录** — 完整历史回顾
- **响应式布局** — 自适应窗口大小

## 快速开始

```bash
# 克隆项目
git clone <repo-url> amazon-games
cd amazon-games

# 安装依赖
npm install

# 启动开发服务器
./amazon-games.sh start
```

浏览器打开 `http://localhost:5173` 即可开始游戏。

## CLI 工具

```bash
./amazon-games.sh start              # 启动服务
./amazon-games.sh stop               # 停止服务
./amazon-games.sh restart            # 重启服务
./amazon-games.sh status             # 查看状态

./amazon-games.sh config set port 8080   # 修改端口
./amazon-games.sh config set host 127.0.0.1  # 仅本地访问
./amazon-games.sh config reset           # 恢复默认

./amazon-games.sh build              # 生产构建 → dist/
./amazon-games.sh preview            # 预览生产版本
```

## 游戏规则

1. **白方先行**，双方轮流操作
2. 每回合分为两步：
   - **移动**：选中己方亚马逊，按皇后走法（横/竖/斜任意格数）移动至空格
   - **射箭**：从新位置同样按皇后走法射出一支箭，箭落点变为**燃烧格**（永久封锁）
3. 亚马逊和箭均不能穿越其他棋子或燃烧格
4. 无法合法移动的一方**判负**

## 项目结构

```
src/
├── game/                 # 纯游戏逻辑，零 UI 依赖
│   ├── types.ts          #   核心类型
│   ├── rules.ts          #   皇后走法、碰撞检测
│   └── game-state.ts     #   状态机（选择→移动→射箭→判定）
├── renderer/
│   └── game-canvas.ts    #   PixiJS WebGL 渲染、动画、特效
├── store/
│   ├── game-store.ts     #   Zustand 游戏状态
│   └── ui-store.ts       #   UI 状态、主题管理
├── components/
│   ├── Layout.tsx        #   整体布局、粒子背景
│   ├── GameSetup.tsx     #   游戏设置面板
│   ├── GameBoard.tsx     #   Canvas 容器
│   ├── GameHUD.tsx       #   回合信息
│   ├── ThemePicker.tsx   #   主题切换
│   ├── MoveHistory.tsx   #   走棋记录
│   └── ResultDialog.tsx  #   胜负弹窗
├── themes/               #   4 种视觉主题配置
└── variants/             #   3 种规则变体配置
```

## 技术栈

| 层 | 技术 | 用途 |
|---|---|---|
| 框架 | React 19 + TypeScript | UI 组件 |
| 构建 | Vite 8 | 开发/打包 |
| 样式 | Tailwind CSS 4 | 布局与装饰 |
| 渲染 | PixiJS 8 | WebGL 棋盘与特效 |
| 状态 | Zustand | 全局状态管理 |
| 动画 | Framer Motion | UI 过渡动画 |

## 许可

MIT
