@echo off
title Conta IA - Iniciar junto com o Windows
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Conta IA - Agente de Etiquetas.lnk')); $s.TargetPath='%~dp0agente.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save(); Write-Host ('[OK] atalho criado em ' + [Environment]::GetFolderPath('Startup'))"
echo.
echo  Pronto: quando este PC ligar, o agente sobe sozinho ^(janela minimizada^).
echo  Pra desfazer, rode o desinstalar-inicializacao.bat.
echo.
pause
