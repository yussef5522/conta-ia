@echo off
setlocal enabledelayedexpansion
title Conta IA - Agente de Etiquetas
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] O Node nao esta instalado neste PC.
  echo      Baixe em https://nodejs.org  ^(versao LTS^) e rode este arquivo de novo.
  echo.
  pause & exit /b 1
)

if not exist config.bat (
  echo.
  echo  ================= PRIMEIRO USO =================
  echo  Cole abaixo o TOKEN do agente.
  echo  Onde pegar: Conta IA ^> Estoque ^> Impressao ^>
  echo              "+ nova impressora" ^> tipo USB ^> salvar.
  echo  O token aparece UMA vez, numa tarja amarela.
  echo.
  set /p TK=Token: 
  if "!TK!"=="" (
    echo  [X] Token vazio. Rode o agente.bat de novo.
    pause & exit /b 1
  )
  (
    echo @echo off
    echo set CONTA_IA_URL=http://198.211.103.10
    echo set AGENTE_TOKEN=!TK!
    echo rem Se o agente nao achar a impressora sozinho, tire o "rem" da linha
    echo rem abaixo e escreva o nome do COMPARTILHAMENTO dela:
    echo rem set ZEBRA_PRINTER=Zebra
  ) > config.bat
  echo.
  echo  [OK] Token guardado em config.bat ^(so precisa fazer isso uma vez^).
  echo.
)

call config.bat
echo  Servidor: %CONTA_IA_URL%
echo  Para parar o agente: feche esta janela.
echo.
node zebra-agente.mjs

echo.
echo  ================================================
echo  O agente PAROU. O motivo esta na mensagem acima.
echo  ================================================
pause
