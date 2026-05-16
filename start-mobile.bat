@echo off
cd /d "%~dp0"
echo Starting Bill Day Pocket...
echo.
node server.js
echo.
echo Server stopped. Press any key to close.
pause >nul
