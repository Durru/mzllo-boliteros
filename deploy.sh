#!/usr/bin/env bash
set -euo pipefail

# Mzllo Boliteros — Deployment Script
# Usage: ./deploy.sh [command]
# Commands: up, down, logs, restart, test, build

COMMAND="${1:-up}"

case "$COMMAND" in
  up)
    echo "🚀 Starting Mzllo Boliteros..."
    docker compose up -d --build
    echo "✅ Running on http://localhost:${PORT:-3000}"
    docker compose logs -f mzllo
    ;;
  down)
    echo "🛑 Stopping Mzllo Boliteros..."
    docker compose down
    ;;
  logs)
    docker compose logs -f mzllo
    ;;
  restart)
    echo "🔄 Restarting Mzllo Boliteros..."
    docker compose restart
    ;;
  test)
    echo "🧪 Running tests..."
    npm test
    ;;
  build)
    echo "🔨 Building Docker image..."
    docker compose build
    echo "✅ Build complete"
    ;;
  *)
    echo "Usage: $0 {up|down|logs|restart|test|build}"
    exit 1
    ;;
esac
