@echo off
REM ============================================================
REM  CyberShield 360 - share ONLINE (teammates anywhere)
REM  Starts backend + frontend, then a Cloudflare tunnel that
REM  gives a public https://....trycloudflare.com link.
REM ============================================================
cd /d "%~dp0"

REM --- download cloudflared the first time, if missing ---
if not exist "tools\cloudflared.exe" (
  echo Downloading cloudflared ^(one-time, ~55 MB^)...
  if not exist tools mkdir tools
  powershell -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'tools\cloudflared.exe' -UseBasicParsing"
)

start "CyberShield Backend"  cmd /k "cd /d %~dp0backend && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && python -m uvicorn app.main:app --port 8000"
start "CyberShield Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo  Waiting ~10s for the servers to start...
timeout /t 10 /nobreak >nul

start "CyberShield PUBLIC LINK" cmd /k "cd /d %~dp0 && tools\cloudflared.exe tunnel --url http://localhost:5173 --no-autoupdate"

echo.
echo ============================================================
echo  Look in the "CyberShield PUBLIC LINK" window for a line like:
echo      https://something-random.trycloudflare.com
echo  Share THAT link with your teammates (works from anywhere).
echo.
echo  Keep all three windows open while sharing.
echo  Close them to stop. The link changes each time you restart.
echo ============================================================
pause
