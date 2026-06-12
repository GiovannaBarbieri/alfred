param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath
)

$ErrorActionPreference = "Stop"

$resolvedBackupPath = Resolve-Path -LiteralPath $BackupPath

Get-Content -Path $resolvedBackupPath -Raw |
    docker exec -i analise-horas-db psql `
        -U analise_horas `
        -d analise_horas

Write-Host "Backup restaurado de: $resolvedBackupPath"
