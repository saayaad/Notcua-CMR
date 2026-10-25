@echo off
cd /d "%~dp0"
title Noctua - iniciar atendimento online
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-noctua-online.ps1"
pause
