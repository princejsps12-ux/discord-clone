@echo off
set "ROOT=%~dp0"
echo Starting API (port 4000) and web (5173)...
start "discord-clone API" cmd /k cd /d "%ROOT%server" ^&^& npm run dev
timeout /t 4 /nobreak >nul
start "discord-clone Web" cmd /k cd /d "%ROOT%client" ^&^& npm run dev
echo.
echo Two windows opened. Browser: http://localhost:5173
pause
