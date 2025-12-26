# Script PowerShell pour vérifier/créer la base de données
$env:PGPASSWORD = 'postgres'
$dbName = 'drc_digit_payment'
$port = '5433'

Write-Host "Vérification de la connexion PostgreSQL sur le port $port..."

# Vérifier si la base de données existe
$dbExists = psql -h localhost -p $port -U postgres -lqt 2>$null | Select-String $dbName

if ($dbExists) {
    Write-Host "✓ La base de données '$dbName' existe déjà." -ForegroundColor Green
} else {
    Write-Host "La base de données '$dbName' n'existe pas." -ForegroundColor Yellow
    Write-Host "Création de la base de données..."
    psql -h localhost -p $port -U postgres -c "CREATE DATABASE $dbName;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Base de données '$dbName' créée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "✗ Erreur lors de la création de la base de données." -ForegroundColor Red
    }
}

