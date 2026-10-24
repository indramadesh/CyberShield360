@echo off
REM ============================================================
REM  CyberShield 360 - run locally (this computer + same Wi-Fi)
REM  Opens the backend and frontend in two windows.
REM  Open http://localhost:5173 in your browser.
REM ============================================================
cd /d "%~dp0"

start "CyberShield Backend"  cmd /k "cd /d %~dp0backend && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && python -m uvicorn app.main:app --port 8000"
start "CyberShield Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  CyberShield 360 is starting in two new windows...
echo.
echo    This computer:   http://localhost:5173
echo    Same Wi-Fi/LAN:  see the "Network:" URL in the Frontend window
echo.
echo  Close those two windows to stop the app.
echo.
pause
