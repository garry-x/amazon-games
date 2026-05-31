#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.dev-server.pid"
CONFIG_FILE="$ROOT/.game-config"
DEFAULT_PORT=5173
DEFAULT_HOST="0.0.0.0"

# ============================================================
# 加载配置
# ============================================================
load_config() {
  PORT="$DEFAULT_PORT"
  HOST="$DEFAULT_HOST"
  if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
  fi
}

# ============================================================
# 保存配置
# ============================================================
save_config() {
  cat > "$CONFIG_FILE" <<EOF
# 亚马逊棋服务配置
PORT=${PORT:-$DEFAULT_PORT}
HOST="${HOST:-$DEFAULT_HOST}"
EOF
  echo "✓ 配置已保存到 $CONFIG_FILE"
}

# ============================================================
# 启动开发服务器
# ============================================================
cmd_start() {
  load_config

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "⚠ 服务已在运行中 (PID: $pid)"
      echo "  地址: http://${HOST}:${PORT}"
      return 1
    fi
    rm -f "$PID_FILE"
  fi

  echo "⚔  亚马逊棋 — 启动中..."
  cd "$ROOT"

  # 确保依赖已安装
  if [[ ! -d node_modules ]]; then
    echo "→ 安装依赖..."
    npm install
  fi

  npx vite --host "$HOST" --port "$PORT" &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    echo "✓ 服务已启动 (PID: $pid)"
    echo "  本地:  http://localhost:${PORT}"
    echo "  网络:  http://${HOST}:${PORT}"
    echo ""
    echo "  停止:  $0 stop"
  else
    echo "✗ 启动失败，请检查日志"
    rm -f "$PID_FILE"
    return 1
  fi
}

# ============================================================
# 停止服务
# ============================================================
cmd_stop() {
  if [[ ! -f "$PID_FILE" ]]; then
    echo "⚠ 没有运行中的服务"
    return 1
  fi

  local pid
  pid=$(cat "$PID_FILE")

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null
    fi
    echo "✓ 服务已停止 (PID: $pid)"
  else
    echo "⚠ 进程 $pid 已不存在"
  fi

  rm -f "$PID_FILE"
}

# ============================================================
# 重启服务
# ============================================================
cmd_restart() {
  cmd_stop 2>/dev/null || true
  sleep 1
  cmd_start
}

# ============================================================
# 查看状态
# ============================================================
cmd_status() {
  load_config

  echo "══════════════════════════════════════"
  echo "  亚马逊棋 — Game of the Amazons"
  echo "══════════════════════════════════════"

  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  状态: ● 运行中"
      echo "  PID:  $pid"
      echo "  地址: http://${HOST}:${PORT}"
    else
      echo "  状态: ○ 已停止 (stale PID: $pid)"
    fi
  else
    echo "  状态: ○ 已停止"
  fi

  echo "  监听: ${HOST}:${PORT}"
  echo ""
  echo "  配置:"
  if [[ -f "$CONFIG_FILE" ]]; then
    grep -v '^#' "$CONFIG_FILE" | grep -v '^$' | sed 's/^/    /'
  else
    echo "    (使用默认配置)"
  fi
}

# ============================================================
# 配置管理
# ============================================================
cmd_config() {
  load_config

  case "${1:-}" in
    set)
      case "${2:-}" in
        port)
          if [[ -z "${3:-}" ]]; then
            echo "用法: $0 config set port <端口号>"
            return 1
          fi
          PORT="$3"
          save_config
          ;;
        host)
          if [[ -z "${3:-}" ]]; then
            echo "用法: $0 config set host <地址>"
            return 1
          fi
          HOST="$3"
          save_config
          ;;
        *)
          echo "用法: $0 config set <port|host> <值>"
          echo ""
          echo "示例:"
          echo "  $0 config set port 8080"
          echo "  $0 config set host 127.0.0.1"
          return 1
          ;;
      esac
      ;;
    get)
      case "${2:-}" in
        port) echo "$PORT" ;;
        host) echo "$HOST" ;;
        all|"")
          echo "PORT=$PORT"
          echo "HOST=$HOST"
          ;;
        *)
          echo "用法: $0 config get <port|host|all>"
          return 1
          ;;
      esac
      ;;
    reset)
      rm -f "$CONFIG_FILE"
      echo "✓ 配置已重置为默认值"
      ;;
    show)
      cmd_status
      ;;
    *)
      echo "用法: $0 config <set|get|reset|show> [参数]"
      echo ""
      echo "  set port <端口>    设置监听端口"
      echo "  set host <地址>    设置监听地址"
      echo "  get port           查看端口"
      echo "  get host           查看地址"
      echo "  get all            查看所有配置"
      echo "  reset              重置为默认值"
      echo "  show               显示完整状态"
      echo ""
      echo "当前配置:"
      echo "  PORT=$PORT"
      echo "  HOST=$HOST"
      ;;
  esac
}

# ============================================================
# 构建生产版本
# ============================================================
cmd_build() {
  echo "⚔  构建生产版本..."
  cd "$ROOT"
  npm run build
  echo "✓ 构建完成 → dist/"
}

# ============================================================
# 预览生产版本
# ============================================================
cmd_preview() {
  load_config
  cd "$ROOT"

  if [[ ! -d dist ]]; then
    echo "→ 尚未构建，先执行构建..."
    cmd_build
  fi

  echo "→ 启动预览服务..."
  npx vite preview --host "$HOST" --port "${PORT}" &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  echo "✓ 预览服务已启动 → http://localhost:${PORT}"
}

# ============================================================
# 帮助
# ============================================================
cmd_help() {
  echo "⚔  亚马逊棋 — Game of the Amazons"
  echo ""
  echo "用法: $0 <命令> [参数]"
  echo ""
  echo "命令:"
  echo "  start               启动开发服务器"
  echo "  stop                停止服务"
  echo "  restart             重启服务"
  echo "  status              查看服务状态"
  echo "  build               构建生产版本到 dist/"
  echo "  preview             预览生产版本"
  echo ""
  echo "  config set port <N>   设置监听端口 (当前: ${PORT:-$DEFAULT_PORT})"
  echo "  config set host <H>   设置监听地址 (当前: ${HOST:-$DEFAULT_HOST})"
  echo "  config get <key>      查看配置项"
  echo "  config reset          重置配置"
  echo "  config show           显示完整状态"
  echo ""
  echo "示例:"
  echo "  $0 start"
  echo "  $0 config set port 8080"
  echo "  $0 restart"
}

# ============================================================
# 主入口
# ============================================================
load_config

case "${1:-help}" in
  start)    shift; cmd_start "$@" ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart ;;
  status)   cmd_status ;;
  build)    cmd_build ;;
  preview)  cmd_preview ;;
  config)   shift; cmd_config "$@" ;;
  help|--help|-h) cmd_help ;;
  *)
    echo "未知命令: ${1:-}"
    echo ""
    cmd_help
    exit 1
    ;;
esac
