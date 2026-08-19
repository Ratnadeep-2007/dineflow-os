@echo off
title DineFlow AI Launchpad
echo =======================================================
echo   DINE AI — Full Stack Restaurant Bot System
echo =======================================================
echo.

:: 1. Start Docker Containers
echo [1/5] Starting Docker containers (PostgreSQL ^& Redis)...
docker start hospitality_postgres wp_redis 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Could not start Docker containers.
    echo Please make sure Docker Desktop is open and running.
) else (
    echo [SUCCESS] PostgreSQL and Redis containers are active.
)
echo.

:: 2. Start Backend NestJS Server
echo [2/5] Starting NestJS Backend Server...
start "Backend API Server (Port 3000)" cmd /k "cd backend && npm run start:dev"

:: 3. Start Frontend React Vite Server
echo [3/5] Starting React Receptionist Dashboard...
start "Receptionist Dashboard (Port 5173)" cmd /k "cd frontend && npm run dev"

:: 4. Start Baileys WhatsApp Gateway
echo [4/5] Starting Baileys WhatsApp Gateway...
start "WhatsApp Bot (Baileys)" cmd /k "cd baileys-gateway && npm run dev"

:: 5. Start Telegram Bot Gateway
echo [5/5] Starting DINE AI Telegram Bot...
start "DINE AI Telegram Bot" cmd /k "cd telegram-gateway && npm run dev"

echo.
echo =======================================================
echo   All systems launched!
echo   - Backend API:         http://localhost:3000
echo   - Dashboard:           http://localhost:5173
echo   - WhatsApp Gateway:    Scan QR in "WhatsApp Bot" window
echo   - Telegram Bot:        Check "Telegram Bot" window for t.me link
echo =======================================================
echo.
pause
