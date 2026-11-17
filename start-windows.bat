@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js 20+ first & pause & exit /b 1)
if not exist .env copy .env.example .env >nul
if not exist node_modules (
  echo Dependencies not installed. Run: npm install --no-audit --no-fund
  echo If on a corporate network, check trusted CA configuration.
  pause
  exit /b 1
)
echo QASphere AI v0.6: open http://127.0.0.1:4177
echo Browser install is one-time: npx playwright install chromium
call npm start
pause
