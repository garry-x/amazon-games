#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.dev-server.pid"
CONFIG_FILE="$ROOT/.game-config"
LOG_DIR="$ROOT/logs"
DEFAULT_PORT=5173
DEFAULT_HOST="0.0.0.0"

mkdir -p "$LOG_DIR"

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
# Math Games 服务配置
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

  # Already running?
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

  echo "🎯 Math Games — 启动中..."
  cd "$ROOT"

  if [[ ! -d node_modules ]]; then
    echo "→ 安装依赖..."
    npm install
  fi

  # Use vite directly so $! is the real server process (npx wrapper dies immediately)
  local log_file="$LOG_DIR/server-$(date +%Y%m%d-%H%M%S).log"
  ./node_modules/.bin/vite --host "$HOST" --port "$PORT" > "$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    echo "✓ 服务已启动 (PID: $pid)"
    echo "  本地:  http://localhost:${PORT}"
    echo "  网络:  http://${HOST}:${PORT}"
    echo "  日志:  $log_file"
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

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "⚠ 进程 $pid 已不存在"
    rm -f "$PID_FILE"
    return 1
  fi

  # Graceful shutdown: TERM → wait → KILL only if needed
  echo "→ 正在停止服务 (PID: $pid)..."
  kill "$pid" 2>/dev/null

  # Wait up to 5 seconds for graceful exit
  for i in $(seq 1 10); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "✓ 服务已停止"
      rm -f "$PID_FILE"
      return 0
    fi
    sleep 0.5
  done

  # Force kill if still running
  echo "→ 进程未响应，强制终止..."
  kill -9 "$pid" 2>/dev/null
  sleep 0.5
  echo "✓ 服务已强制停止"
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
  echo "  Math Games — 数学策略游戏合集"
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
# ARM64: 为 x86_64 aapt2 设置 qemu 模拟
# ============================================================
_setup_aapt2_qemu() {
  local QEMU_BIN="$HOME/.local/bin/qemu-x86_64-static"
  local SYSROOT="$HOME/.local/x86-sysroot"

  # Already configured?
  if [[ -x "$QEMU_BIN" ]] && [[ -d "$SYSROOT/lib64" ]]; then
    return 0
  fi

  echo "→ ARM64 环境: 配置 x86_64 模拟层..."

  # Download qemu-user-static if needed
  if [[ ! -x "$QEMU_BIN" ]]; then
    mkdir -p "$HOME/.local/bin"
    local QEMU_DEB="/tmp/qemu-user-static_arm64.deb"
    if [[ ! -f "$QEMU_DEB" ]]; then
      apt-get download -o Dir="/tmp" qemu-user-static 2>/dev/null && \
        mv /tmp/qemu-user-static_*.deb "$QEMU_DEB" 2>/dev/null || true
    fi
    if [[ -f "$QEMU_DEB" ]]; then
      local TMP_QEMU="/tmp/qemu-extract-$$"
      mkdir -p "$TMP_QEMU" && dpkg-deb -x "$QEMU_DEB" "$TMP_QEMU" 2>/dev/null
      cp "$TMP_QEMU/usr/bin/qemu-x86_64-static" "$QEMU_BIN" 2>/dev/null
      rm -rf "$TMP_QEMU"
      chmod +x "$QEMU_BIN" 2>/dev/null
    fi
  fi

  # Set up x86_64 sysroot if needed
  if [[ ! -d "$SYSROOT/lib64" ]] && [[ -x "$QEMU_BIN" ]]; then
    mkdir -p "$SYSROOT"
    local LIBC_DEB="/tmp/libc6_amd64.deb"
    if [[ ! -f "$LIBC_DEB" ]]; then
      local LIBC_VER
      LIBC_VER=$(dpkg -l libc6 2>/dev/null | grep 'libc6:arm64' | awk '{print $3}')
      [[ -z "$LIBC_VER" ]] && LIBC_VER="2.39-0ubuntu8.7"
      curl -sL --connect-timeout 30 --max-time 120 -o "$LIBC_DEB" \
        "http://archive.ubuntu.com/ubuntu/pool/main/g/glibc/libc6_${LIBC_VER}_amd64.deb" 2>/dev/null || true
    fi
    if [[ -f "$LIBC_DEB" ]] && file "$LIBC_DEB" | grep -q "Debian binary"; then
      dpkg-deb -x "$LIBC_DEB" "$SYSROOT" 2>/dev/null
      mkdir -p "$SYSROOT/lib64" && ln -sf ../usr/lib64/ld-linux-x86-64.so.2 "$SYSROOT/lib64/ld-linux-x86-64.so.2" 2>/dev/null
      ln -sf usr/lib64 "$SYSROOT/lib" 2>/dev/null
    fi

    # Also get libgcc_s and libstdc++ for x86_64
    for pkg in libgcc-s1 libstdc++6; do
      local DEB="/tmp/${pkg}_amd64.deb"
      if [[ ! -f "$DEB" ]]; then
        local PKG_VER
        PKG_VER=$(dpkg -l "$pkg" 2>/dev/null | grep "$pkg:arm64" | awk '{print $3}')
        [[ -z "$PKG_VER" ]] && PKG_VER="14.2.0-4ubuntu2~24.04.1"
        local SRC="gcc-14"
        [[ "$pkg" == "zlib1g" ]] && SRC="zlib"
        curl -sL --connect-timeout 30 --max-time 120 -o "$DEB" \
          "http://archive.ubuntu.com/ubuntu/pool/main/g/${SRC}/${pkg}_${PKG_VER}_amd64.deb" 2>/dev/null || true
      fi
      if [[ -f "$DEB" ]] && file "$DEB" | grep -q "Debian binary"; then
        dpkg-deb -x "$DEB" "$SYSROOT" 2>/dev/null
      fi
    done
  fi

  # Wrap cached aapt2 binaries with qemu
  if [[ -x "$QEMU_BIN" ]] && [[ -d "$SYSROOT/lib64" ]]; then
    find "$HOME/.gradle/caches" -path "*/aapt2-*-linux/aapt2" -not -name "aapt2.real" 2>/dev/null | while read -r aapt2; do
      if file "$aapt2" 2>/dev/null | grep -q "x86-64"; then
        mv "$aapt2" "${aapt2}.real" 2>/dev/null
        cat > "$aapt2" << 'QEMUWRAP'
#!/bin/sh
export QEMU_LD_PREFIX=HOME_X86_SYSROOT
exec HOME_QEMU_BIN "$(dirname "$0")/aapt2.real" "$@"
QEMUWRAP
        sed -i "s|HOME_X86_SYSROOT|$SYSROOT|g; s|HOME_QEMU_BIN|$QEMU_BIN|g" "$aapt2"
        chmod +x "$aapt2"
      fi
    done
    echo "  ✓ x86_64 模拟层已就绪"
  fi
}

# ============================================================
# 构建生产版本
# ============================================================
cmd_build() {
  local target="${1:-web}"

  case "$target" in
    android|apk)
      echo "📱 构建 Android APK..."
      cd "$ROOT"

      # Check build requirements
      if ! command -v java &>/dev/null; then
        echo "✗ 未检测到 Java (需要 JDK 17+)"
        echo "  安装: sdk install java 17.0.0-tem"
        return 1
      fi

      local java_ver
      java_ver=$(java -version 2>&1 | head -1 | sed 's/.*version "//;s/".*//' | cut -d. -f1)
      if [[ -z "$java_ver" ]] || [[ "$java_ver" -lt 17 ]]; then
        echo "⚠ Java 版本可能过低 (需要 JDK 17+)，当前: $(java -version 2>&1 | head -1)"
      fi

      # Auto-detect ANDROID_SDK_ROOT if not set
      if [[ -z "${ANDROID_HOME:-}" ]] && [[ -z "${ANDROID_SDK_ROOT:-}" ]]; then
        if [[ -d "$ROOT/android-sdk" ]]; then
          export ANDROID_SDK_ROOT="$ROOT/android-sdk"
          export ANDROID_HOME="$ANDROID_SDK_ROOT"
        else
          echo "⚠ 未设置 ANDROID_HOME / ANDROID_SDK_ROOT"
          echo "  API 34+ 的 Android SDK 是必需的"
        fi
      fi
      export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
      export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

      # ARM64: set up qemu wrapper for x86_64 aapt2 if needed
      if [[ "$(uname -m)" == "aarch64" ]]; then
        _setup_aapt2_qemu
      fi

      echo "→ 构建 Web 资源..."
      npm run build || return 1
      echo "→ 同步 Capacitor..."
      npx cap sync || return 1
      echo "→ 编译 APK..."
      cd "$ROOT/android"

      # Ensure correct JDK
      local jdk_home="${JAVA_HOME:-}"
      if [[ -z "$jdk_home" ]]; then
        for jdk in /usr/lib/jvm/java-21-openjdk-arm64 /usr/lib/jvm/java-17-openjdk-arm64 /usr/lib/jvm/openjdk-21; do
          [[ -d "$jdk" ]] && { jdk_home="$jdk"; break; }
        done
      fi
      [[ -n "$jdk_home" ]] && export JAVA_HOME="$jdk_home" && export PATH="$JAVA_HOME/bin:$PATH"

      ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" ANDROID_HOME="$ANDROID_HOME" JAVA_HOME="$JAVA_HOME" \
        ./gradlew assembleDebug || {
        echo "✗ APK 构建失败，请检查 Android SDK 配置"
        return 1
      }
      cd "$ROOT"
      local apk="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
      if [[ -f "$apk" ]]; then
        cp "$apk" "$ROOT/public/math-games.apk"
        echo "✓ APK 构建完成"
        echo "  输出: android/app/build/outputs/apk/debug/app-debug.apk"
        echo "  网站: /math-games.apk (已复制到 public/，可通过网页下载)"
        ls -lh "$apk" | awk '{print "  大小: " $5}'
      else
        echo "✗ APK 未生成，请检查 Gradle 输出"
        return 1
      fi
      ;;
    web|"")
      echo "🎯 构建生产版本..."
      cd "$ROOT"
      npm run build
      echo "✓ 构建完成 → dist/"
      ;;
    *)
      echo "用法: $0 build [web|android]"
      echo ""
      echo "  web        构建 Web 生产版本 (默认)"
      echo "  android    构建 Android APK"
      return 1
      ;;
  esac
}

# ============================================================
# AI 纹理生成（需要 ComfyUI 在 http://127.0.0.1:8188 运行）
# ============================================================
cmd_generate() {
  local theme="${1:-all}"
  local type="${2:-bg}"

  if ! curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
    echo "✗ ComfyUI 未运行 (http://127.0.0.1:8188)"
    echo "  请先启动 ComfyUI 后再试"
    return 1
  fi

  echo "🎯 Math Games — AI 纹理生成"
  echo "  主题: $theme  类型: $type"
  echo ""

  cd "$ROOT"
  node scripts/generate-textures.mjs "$theme" "$type"
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
  local log_file="$LOG_DIR/preview-$(date +%Y%m%d-%H%M%S).log"
  ./node_modules/.bin/vite preview --host "$HOST" --port "${PORT}" > "$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  echo "✓ 预览服务已启动 → http://localhost:${PORT}"
  echo "  日志: $log_file"
}

# ============================================================
# 查看日志
# ============================================================
cmd_logs() {
  local lines="${1:-20}"
  echo "══════════════════════════════════════"
  echo "  最近的日志文件"
  echo "══════════════════════════════════════"
  if [[ -d "$LOG_DIR" ]] && [[ -n "$(ls -A "$LOG_DIR" 2>/dev/null)" ]]; then
    ls -lt "$LOG_DIR"/*.log 2>/dev/null | head -10
    echo ""
    local latest
    latest=$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -1)
    if [[ -n "$latest" ]]; then
      echo "── ${latest##*/} (最近 ${lines} 行) ──"
      tail -"$lines" "$latest"
    fi
  else
    echo "  (暂无日志)"
  fi
}

# ============================================================
# 帮助
# ============================================================
cmd_help() {
  echo "🎯 Math Games — Game of the Amazons"
  echo ""
  echo "用法: $0 <命令> [参数]"
  echo ""
  echo "命令:"
  echo "  start               启动开发服务器"
  echo "  stop                停止服务"
  echo "  restart             重启服务"
  echo "  status              查看服务状态"
  echo "  build [web|android]  构建 (web → dist/, android → APK)"
  echo "  android              构建 Android APK (快捷方式)"
  echo "  preview             预览生产版本"
  echo "  logs [行数]          查看最近日志"
  echo "  evaluate [--quick]    质量评估 (交互/功能/代码/性能)"
  echo "  generate [主题] [类型]  AI 纹理生成 (需 ComfyUI)"
  echo "    主题: all / egyptian / medieval / scifi / nature"
  echo "    类型: bg / board / all"
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
  build)    shift; cmd_build "$@" ;;
  android)   cmd_build android ;;
  preview)  cmd_preview ;;
  logs)     shift; cmd_logs "$@" ;;
  generate) shift; cmd_generate "$@" ;;
  config)   shift; cmd_config "$@" ;;
  help|--help|-h) cmd_help ;;
  *)
    echo "未知命令: ${1:-}"
    echo ""
    cmd_help
    exit 1
    ;;
esac
