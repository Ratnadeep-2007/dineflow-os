@echo off
title DineFlow AI Production Deployer
echo =======================================================
echo    🚀 Deploying DineFlow AI Production Stack
echo =======================================================
echo.

:: Check Docker
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install or open Docker Desktop and try again.
    pause
    exit /b 1
)

:: Check for .env file
if not exist ".env" (
    echo [WARNING] No .env file found. Creating from .env.example...
    copy .env.example .env
    echo.
    echo Please update the .env file with your GEMINI_API_KEY and other credentials, then run deploy.bat again.
    pause
    exit /b 1
)

echo [1/3] Building production container images...
docker compose build

echo.
echo [2/3] Starting database and applying migrations...
docker compose up -d postgres redis
docker compose run --rm db-migrate

echo.
echo [3/3] Launching all services in background...
docker compose up -d

echo.
echo =======================================================
echo    ✅ DineFlow AI Stack is now LIVE!
echo    • Receptionist Dashboard: http://localhost:5173 or http://localhost
echo    • Backend API:            http://localhost:3000
echo    • View WhatsApp QR Code:  docker logs -f dineflow-baileys-gateway
echo    • View Telegram Bot Logs: docker logs -f dineflow-telegram-gateway
echo =======================================================
echo.
pause
