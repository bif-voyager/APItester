@echo off
cd /d "%~dp0"
echo Starting API Client...
npm run electron:dev
pause
