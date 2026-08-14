@echo off
setlocal
title Alfred - Backend
cd /d "%~dp0backend"

set SQLSERVER_DRIVER=ODBC Driver 18 for SQL Server
set SQLSERVER_HOST=srvbanco009
set SQLSERVER_PORT=1463
set SQLSERVER_DATABASE=Tfs_Fabrica
set SQLSERVER_AUTH=windows
set SQLSERVER_USER=
set SQLSERVER_PASSWORD=
set SQLSERVER_ENCRYPT=false
set SQLSERVER_TRUST_CERT=true

echo Iniciando o backend do Alfred com sua autenticacao do Windows...
echo Usuario atual: %USERDOMAIN%\%USERNAME%
echo SQL Server: %SQLSERVER_HOST%,%SQLSERVER_PORT% / %SQLSERVER_DATABASE%
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
echo.

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

echo.
echo O backend foi encerrado. Pressione qualquer tecla para fechar.
pause >nul
