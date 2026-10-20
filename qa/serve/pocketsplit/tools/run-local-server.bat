@echo off
REM PocketSplit - local preview server for Windows 10
REM Starts a tiny Python web server in this folder and opens the app.
REM Requires Python (free): https://www.python.org/downloads/windows/

cd /d "%~dp0.."
echo.
echo  PocketSplit local preview
echo  -------------------------
echo  Address: http://localhost:8000
echo  Press Ctrl+C in this window to stop the server.
echo.

start "" "http://localhost:8000"
python -m http.server 8000
if errorlevel 1 (
  echo.
  echo  Python was not found. Trying Node.js instead...
  npx --yes http-server -p 8000 -c-1
)
pause
