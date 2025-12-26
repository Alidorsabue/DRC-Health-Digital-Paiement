# Script PowerShell pour exécuter la migration SQL
# Essaie d'abord avec psql, puis utilise Node.js si psql n'est pas disponible

param(
    [string]$MigrationFile = "migrations/change_prestataire_id_format.sql"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Migration du format d'ID Prestataire" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Charger les variables d'environnement depuis .env
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$dbHost = $env:DB_HOST ?? "localhost"
$dbPort = $env:DB_PORT ?? "5432"
$dbUser = $env:DB_USERNAME ?? "postgres"
$dbPassword = $env:DB_PASSWORD ?? "postgres"
$dbName = $env:DB_NAME ?? "drc_digit_payment"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Host: $dbHost"
Write-Host "  Port: $dbPort"
Write-Host "  Database: $dbName"
Write-Host "  User: $dbUser"
Write-Host ""

# Méthode 1: Essayer avec psql
$psqlPath = $null
$possiblePaths = @(
    "C:\Program Files\PostgreSQL\*\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\*\bin\psql.exe",
    "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe",
    "$env:ProgramFiles(x86)\PostgreSQL\*\bin\psql.exe"
)

foreach ($pattern in $possiblePaths) {
    $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $psqlPath = $found.FullName
        break
    }
}

if ($psqlPath) {
    Write-Host "✓ psql trouvé: $psqlPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Exécution avec psql..." -ForegroundColor Yellow
    
    $env:PGPASSWORD = $dbPassword
    $sqlFile = Join-Path $PSScriptRoot $MigrationFile
    
    if (-not (Test-Path $sqlFile)) {
        Write-Host "❌ Fichier SQL introuvable: $sqlFile" -ForegroundColor Red
        exit 1
    }
    
    $arguments = @(
        "-h", $dbHost
        "-p", $dbPort
        "-U", $dbUser
        "-d", $dbName
        "-f", $sqlFile
    )
    
    & $psqlPath $arguments
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration terminée avec succès!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host ""
        Write-Host "⚠️  Erreur avec psql, tentative avec Node.js..." -ForegroundColor Yellow
    }
}

# Méthode 2: Utiliser Node.js
Write-Host ""
Write-Host "Exécution avec Node.js..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Options alternatives:" -ForegroundColor Yellow
    Write-Host "1. Installer PostgreSQL et ajouter psql au PATH"
    Write-Host "2. Utiliser pgAdmin pour exécuter le fichier SQL manuellement"
    Write-Host "3. Installer Node.js depuis https://nodejs.org/"
    exit 1
}

$scriptPath = Join-Path $PSScriptRoot "scripts/run-migration-simple.js"

if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Script Node.js introuvable: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Exécution du script Node.js..." -ForegroundColor Yellow
node $scriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migration terminée avec succès!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de la migration" -ForegroundColor Red
    exit 1
}
















