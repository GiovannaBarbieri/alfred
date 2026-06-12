param(
    [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedOutputDir = Join-Path $projectRoot $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $resolvedOutputDir "analise-horas-$timestamp.sql"

docker exec analise-horas-db pg_dump `
    -U analise_horas `
    -d analise_horas `
    --clean `
    --if-exists |
    Set-Content -Path $backupPath -Encoding utf8

Write-Host "Backup criado em: $backupPath"
