# ⚔ 亚马逊棋 — Game of the Amazons

> 支持 AI 对战、多种变体与主题的华丽浏览器双人策略棋类

亚马逊棋（Game of the Amazons）由 Walter Zamkauskas 于 1988 年发明。双方各控制亚马逊战士（皇后走法），每回合移动一枚棋子并射出一支箭封锁格子，最后能移动的一方获胜。

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-8-646cff?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/PixiJS-8-f02854" alt="PixiJS">
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/ComfyUI-Flux-d4a017" alt="ComfyUI">
  <img src="https://img.shields.io/badge/vLLM-Qwen_35B-4ecdc4" alt="vLLM">
</p>

---

## 特性

### 游戏
- **3 种棋盘规格** — 小型 6×6 / 标准 10×10 / 大型 14×14
- **3 种规则变体** — 经典 (4 子) / 军阀 (2 子快节奏) / 围城 (6 子史诗)
- **AI 对战** — 本地 vLLM Qwen 35B，初级/中级/高级三档难度
- **平局判定** — 双方均无法移动时自动判平

### 视觉
- **4 套 AI 生成主题** — 古埃及 / 中世纪 / 科幻 / 自然
- **每套含**：背景图 + 棋盘纹理 + 棋子精灵 + 坑洞贴图 + 瓷砖纹理
- **玻璃质感棋盘** — 多层阴影 + 表面反射 + 圆角边框
- **3D 棋子** — 绿幕抠图透明 PNG，带辉光脉冲动画
- **三段射箭动画** — 拉弓闪光 → 箭矢飞行 → 命中冲击波 + 粒子
- **持续火焰特效** — 燃烧格持续冒火粒子
- **实时主题预览** — 首页切换主题时背景即时变化

### 平台
- **桌面 + 平板 + 手机** — PixiJS 内置 Pointer Events 统一触控
- **PWA 支持** — 可添加到主屏幕，全屏独立运行
- **iPad 安全区适配** — 顶栏避开刘海/状态栏

---

## 快速开始

```bash
git clone git@github.com:garry-x/amazon-games.git
cd amazon-games
npm install
./amazon-games.sh start
```

浏览器打开 `http://localhost:5173`。

## CLI 工具

```bash
./amazon-games.sh start              # 启动开发服务器
./amazon-games.sh stop               # 停止服务
./amazon-games.sh restart            # 重启服务
./amazon-games.sh status             # 查看状态
./amazon-games.sh logs [行数]        # 查看日志

./amazon-games.sh config set port 8080   # 修改端口
./amazon-games.sh config set host 127.0.0.1  # 仅本地访问

./amazon-games.sh build              # 生产构建 → dist/
./amazon-games.sh preview            # 预览生产版本
```

### AI 纹理生成（需要 ComfyUI）

```bash
# 生成所有主题的全部纹理
./amazon-games.sh generate all all

# 生成指定主题
./amazon-games.sh generate scifi piece    # 科幻主题棋子
./amazon-games.sh generate egyptian burn  # 古埃及坑洞
./amazon-games.sh generate all board      # 全部棋盘+瓷砖
```

支持的纹理类型：`bg` `board` `tile-light` `tile-dark` `piece-white` `piece-black` `burn`

## AI 对战

首页勾选「🤖 AI 对战」即可启用。需要本地运行 vLLM：

```bash
# vLLM 服务需在 http://127.0.0.1:8000/v1 可用
# 模型：Qwen3.6-35B-A3B-FP8
```

AI 不可用时自动降级为随机走棋。难度差异：

| | 初级 | 中级 | 高级 |
|---|---|---|---|
| 前瞻深度 | 即时 | 1-2 步 | 3-4 步 |
| 响应速度 | ~10s | ~20s | ~30s |

## 游戏规则

1. **白方先行**，双方轮流
2. 每回合：**移动** (皇后走法) → **射箭** (皇后走法，落点永久封锁)
3. 不可穿越其他棋子或燃烧格
4. 无法移动的一方判负，双方均无法移动为平局

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 渲染 | PixiJS 8 WebGL |
| 状态 | Zustand |
| 动画 | Framer Motion + PixiJS Ticker |
| AI 对战 | vLLM (OpenAI API) + Qwen 35B |
| 纹理生成 | ComfyUI + Flux.1 Dev |
| 样式 | Tailwind CSS 4 |
| PWA | Web App Manifest + Service Worker |

## 项目结构

```
src/
├── game/              # 纯游戏逻辑
│   ├── types.ts       #   核心类型
│   ├── rules.ts       #   皇后走法、碰撞检测
│   └── game-state.ts  #   状态机 + 胜负/平局判定
├── ai/
│   └── engine.ts      #   vLLM AI 引擎
├── renderer/
│   └── game-canvas.ts #   PixiJS 渲染、动画、特效、交互
├── store/
│   ├── game-store.ts  #   游戏状态 + AI 回合管理
│   └── ui-store.ts    #   主题预览
├── components/        #   React 界面
├── themes/            #   4 套主题配置
└── variants/          #   3 种变体配置
scripts/
└── generate-textures.mjs  # ComfyUI 纹理生成
public/textures/           # 预生成纹理 (~40 张)
```

## 许可

MIT
