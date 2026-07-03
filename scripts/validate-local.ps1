param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$backendPython = Join-Path $backendDir ".venv\Scripts\python.exe"

function Invoke-ValidationStep {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    $startedAt = Get-Date
    & $Action
    $elapsed = (Get-Date) - $startedAt
    Write-Host ("OK: {0} ({1:n1}s)" -f $Name, $elapsed.TotalSeconds) -ForegroundColor Green
}

function Assert-CommandAvailable {
    param(
        [string]$CommandName,
        [string]$InstallHint
    )

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "$CommandName nao foi encontrado. $InstallHint"
    }
}

try {
    Write-Host "Validacao local do Alfred" -ForegroundColor White
    Write-Host "Pasta do projeto: $repoRoot"

    if (-not $SkipBackend) {
        if (-not (Test-Path $backendPython)) {
            throw "Ambiente Python do backend nao encontrado em $backendPython. Crie o ambiente virtual e instale as dependencias antes de validar."
        }

        if (-not $SkipSmoke) {
            Invoke-ValidationStep "Backend: imports principais" {
                Push-Location $backendDir
                try {
                    & $backendPython -c "import fastapi, pandas, psycopg, uvicorn; import app.main; print('backend imports ok')"
                }
                finally {
                    Pop-Location
                }
            }
        }

        Invoke-ValidationStep "Backend: testes automatizados" {
            Push-Location $backendDir
            try {
                & $backendPython -m unittest discover -s tests
            }
            finally {
                Pop-Location
            }
        }
    }
    else {
        Write-Host ""
        Write-Host "Backend ignorado por parametro." -ForegroundColor Yellow
    }

    if (-not $SkipFrontend) {
        Assert-CommandAvailable "npm.cmd" "Instale o Node.js ou abra o terminal em um ambiente com npm disponivel."

        Invoke-ValidationStep "Frontend: build de producao" {
            Push-Location $frontendDir
            try {
                & npm.cmd run build
            }
            finally {
                Pop-Location
            }
        }
    }
    else {
        Write-Host ""
        Write-Host "Frontend ignorado por parametro." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "Validacao concluida com sucesso." -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "Validacao falhou: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
