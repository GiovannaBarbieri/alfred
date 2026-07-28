@echo off
setlocal
title Alfred - Frontend

curl.exe --max-time 2 --silent --output NUL http://127.0.0.1:5173
if %ERRORLEVEL% EQU 0 (
    echo O frontend do Alfred ja esta em execucao.
    echo Acesse: http://127.0.0.1:5173
    exit /b 0
)

cd /d "%~dp0frontend"

echo Iniciando o frontend do Alfred...
echo Acesse: http://127.0.0.1:5173
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
echo.

call npm.cmd run dev

echo.
echo O frontend foi encerrado. Pressione qualquer tecla para fechar.
pause >nul
