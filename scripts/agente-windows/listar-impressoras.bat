@echo off
title Conta IA - Impressoras do Windows
cd /d "%~dp0"
node zebra-agente.mjs --impressoras
pause
