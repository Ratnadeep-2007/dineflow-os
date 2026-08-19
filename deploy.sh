#!/usr/bin/env bash
set -e

# ==============================================================================
# DineFlow AI — Production Deployment Script (Docker Compose)
# ==============================================================================

echo "======================================================="
echo "   🚀 Deploying DineFlow AI Production Stack"
echo "======================================================="

# Check Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed."
    exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "👉 Please update your .env file with your API keys (GEMINI_API_KEY, etc.) and rerun ./deploy.sh"
    exit 1
fi

echo "📦 1. Pulling / Building container images..."
docker compose build --parallel

echo "🔄 2. Starting database, redis, and running migrations..."
docker compose up -d postgres redis
docker compose run --rm db-migrate

echo "⚡ 3. Launching all production services..."
docker compose up -d

echo "======================================================="
echo "   ✅ DineFlow AI Stack is now LIVE!"
echo "   • Receptionist Dashboard & Menu: http://localhost (Port 80/5173)"
echo "   • Backend API & WebSockets:      http://localhost:3000"
echo "   • WhatsApp Gateway:              docker logs -f dineflow-baileys-gateway"
echo "   • Telegram Bot:                  docker logs -f dineflow-telegram-gateway"
echo "======================================================="
