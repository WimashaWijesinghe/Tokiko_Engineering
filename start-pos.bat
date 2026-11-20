@echo off
setlocal
title Smart POS System - MySQL
cd /d "%~dp0"
if not exist .env.local (
  echo Missing .env.local. Follow INSTALL-WINDOWS.md first.
  pause
  exit /b 1
)
if not exist .next\BUILD_ID (
  echo Missing production build. Run npm ci and npm run build first.
  pause
  exit /b 1
)
echo Start MySQL in XAMPP. Open http://localhost:4500 after Ready appears.
call npm start
pause
