@echo off
setlocal
title Alfred - Backend
cd /d "%~dp0backend"

echo Iniciando o backend do Alfred com sua autenticacao do Windows...
echo Usuario atual: %USERDOMAIN%\%USERNAME%
echo Configuracao do SQL Server carregada do arquivo .env do projeto.
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
echo.

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

echo.
echo O backend foi encerrado. Pressione qualquer tecla para fechar.
pause >nul
