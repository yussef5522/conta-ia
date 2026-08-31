@echo off
title Conta IA - Teste de impressao
cd /d "%~dp0"
if exist config.bat call config.bat
echo  Mandando uma etiqueta de teste pra Zebra...
echo.
node zebra-agente.mjs --teste
echo.
echo  Se saiu papel: esta tudo certo, pode usar o agente.bat.
echo  Se deu erro: rode o listar-impressoras.bat.
pause
