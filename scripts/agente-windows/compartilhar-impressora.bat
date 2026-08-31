@echo off
title Conta IA - Compartilhar a Zebra
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] Precisa de administrador.
  echo      Clique com o botao DIREITO neste arquivo e escolha
  echo      "Executar como administrador".
  echo.
  pause & exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-Printer | Where-Object { $_.Name -match 'zebra|zdesigner|zpl|ZD\d|GK\d|GC\d|TLP' } | Select-Object -First 1; if (-not $p) { Write-Host '[X] Nenhuma impressora Zebra encontrada. Instale o driver ZDesigner primeiro.'; exit 1 }; Set-Printer -Name $p.Name -Shared $true -ShareName 'Zebra'; Write-Host ('[OK] ' + $p.Name + '  ->  \\localhost\Zebra')"
echo.
pause
