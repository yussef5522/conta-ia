@echo off
title Conta IA - Nao iniciar com o Windows
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=Join-Path ([Environment]::GetFolderPath('Startup')) 'Conta IA - Agente de Etiquetas.lnk'; if (Test-Path $f) { Remove-Item $f; Write-Host '[OK] removido' } else { Write-Host 'nao estava instalado' }"
pause
