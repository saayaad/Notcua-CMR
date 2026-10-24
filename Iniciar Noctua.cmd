@echo off
cd /d "%~dp0"
echo Iniciando o Noctua. Mantenha esta janela aberta enquanto usa o sistema.
node scripts/start-local.mjs
pause
