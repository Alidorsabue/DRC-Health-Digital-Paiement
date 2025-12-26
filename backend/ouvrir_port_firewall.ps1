# Script pour ouvrir le port 3001 dans le firewall Windows

Write-Host "=== Configuration du firewall pour le port 3001 ===" -ForegroundColor Cyan

# Vérifier si la règle existe déjà
$existingRule = Get-NetFirewallRule -DisplayName "Backend Port 3001" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "La règle existe déjà. Suppression de l'ancienne règle..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "Backend Port 3001"
}

# Créer la règle pour autoriser le port 3001
Write-Host "Création de la règle firewall pour le port 3001..." -ForegroundColor Green

New-NetFirewallRule -DisplayName "Backend Port 3001" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3001 `
    -Action Allow `
    -Profile Domain,Private,Public `
    -Description "Autorise les connexions au serveur backend sur le port 3001"

if ($?) {
    Write-Host "✅ Règle firewall créée avec succès !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le port 3001 est maintenant accessible depuis le réseau." -ForegroundColor Green
    Write-Host "Vous pouvez maintenant tester la connexion depuis votre téléphone." -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la création de la règle firewall." -ForegroundColor Red
    Write-Host "Vous devez exécuter ce script en tant qu'administrateur." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

