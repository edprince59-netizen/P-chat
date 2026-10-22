@echo off
start "VIMO development server" /D "%~dp0" cmd /k npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
timeout /t 3 /nobreak >nul

set "BRAVE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%BRAVE%" set "BRAVE=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not exist "%BRAVE%" set "BRAVE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"

if exist "%BRAVE%" (
  start "" "%BRAVE%" http://localhost:5173/
) else (
  start "" http://localhost:5173/
)
