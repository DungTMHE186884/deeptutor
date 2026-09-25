@echo off
chcp 65001 >nul
rem ==== PathMind dev launcher: backend :8001 + frontend :3782 ====
set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%
cd /d "%ROOT%"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
rem Demo payment mode shows the "simulate payment" button. Set to false in production.
if "%BILLING_DEMO_MODE%"=="" set BILLING_DEMO_MODE=true
set PYTHONPATH=%ROOT%
set PYTHONIOENCODING=utf-8
set PATHMIND_API_BASE_URL=http://127.0.0.1:8001
set BACKEND_PORT=8001
set PATHMIND_AUTH_ENABLED=true
set NEXT_PUBLIC_AUTH_ENABLED=true
start "PathMind backend" /min cmd /c "python -m uvicorn pathmind.api.main:app --host 127.0.0.1 --port 8001 > %ROOT%\logs\backend.log 2>&1"
cd /d "%ROOT%\web"
start "PathMind frontend" /min cmd /c "npm run dev -- -p 3782 > %ROOT%\logs\frontend.log 2>&1"
echo PathMind is starting: http://127.0.0.1:3782  (logs in %ROOT%\logs)
