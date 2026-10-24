@echo off
REM ============================================================
REM  CyberShield 360 - one-time setup (run this ONCE)
REM  Installs backend (Python) and frontend (Node) packages.
REM  Requires Python 3.11+ and Node.js 18+ already installed.
REM ============================================================
cd /d "%~dp0"

echo.
echo [1/2] Installing backend packages (Python)...
cd backend
python -m pip install -r requirements.txt
if errorlevel 1 ( echo. & echo Backend install FAILED. Is Python installed and on PATH? & pause & exit /b 1 )
cd ..

echo.
echo [2/2] Installing frontend packages (Node)...
cd frontend
call npm install
if errorlevel 1 ( echo. & echo Frontend install FAILED. Is Node.js installed? & pause & exit /b 1 )
cd ..

echo.
echo ============================================================
echo  Setup complete!
echo  - To run locally:            double-click  run-local.bat
echo  - To share online with team: double-click  run-share.bat
echo ============================================================
pause
