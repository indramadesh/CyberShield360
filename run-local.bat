@echo off
REM ============================================================
REM  CyberShield 360 - run locally (this computer + same Wi-Fi)
REM  Opens the backend and frontend in two windows.
REM  Open http://localhost:5173 in your browser.
REM ============================================================
cd /d "%~dp0"

start "CyberShield Backend"  cmd /k "cd /d %~dp0backend && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && python -m uvicorn app.main:app --port 8000"
start "CyberShield Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
REM Content worker: collects news/advisories and picks the daily lesson, quiz and tip.
start "CyberShield Content Worker" cmd /k "cd /d %~dp0backend && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && timeout /t 8 >nul && python -m app.content.worker"

echo.
echo  CyberShield 360 is starting in three new windows (backend, frontend, content worker)...
echo.
echo    This computer:   http://localhost:5173
echo    Same Wi-Fi/LAN:  see the "Network:" URL in the Frontend window
echo.
echo  Close those windows to stop the app.
echo.
pause
