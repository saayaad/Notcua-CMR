@echo off
cd /d "%~dp0"
title Noctua - iniciar atendimento online
set "NOCTUA_PWSH=%LOCALAPPDATA%\Noctua\tools\powershell-7.6.9\pwsh.exe"
if not exist "%NOCTUA_PWSH%" (
  where pwsh.exe >nul 2>&1
  if errorlevel 1 (set "NOCTUA_PWSH=powershell.exe") else (set "NOCTUA_PWSH=pwsh.exe")
)
"%NOCTUA_PWSH%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-noctua-online.ps1"
pause
