# Script de test pour vérifier que le serveur backend fonctionne

Write-Host "=== Test du serveur backend ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Vérifier que le port écoute
Write-Host "1. Vérification que le port 3001 écoute..." -ForegroundColor Yellow
$portListen = netstat -ano | findstr ":3001" | findstr "LISTENING"
if ($portListen) {
    Write-Host "   ✅ Le port 3001 écoute" -ForegroundColor Green
    Write-Host "   $portListen" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Le port 3001 n'écoute pas !" -ForegroundColor Red
    Write-Host "   Le serveur backend n'est probablement pas démarré." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test 2: Vérifier l'IP actuelle
Write-Host "2. Vérification de l'adresse IP..." -ForegroundColor Yellow
$ipConfig = ipconfig | Select-String "IPv4" | Select-Object -First 1
if ($ipConfig) {
    Write-Host "   ✅ Adresse IP trouvée" -ForegroundColor Green
    Write-Host "   $ipConfig" -ForegroundColor Gray
} else {
    Write-Host "   ⚠️  Impossible de trouver l'adresse IP" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Tester localhost
Write-Host "3. Test de connexion à localhost:3001..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Le serveur répond sur localhost !" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Le serveur ne répond pas sur localhost !" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Le serveur backend a un problème. Vérifiez les logs du serveur." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test 4: Tester l'IP réseau
Write-Host "4. Test de connexion à l'IP réseau..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "10.135.*" }).IPAddress
if ($ipAddress) {
    Write-Host "   IP détectée: $ipAddress" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://$ipAddress:3001/api" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   ✅ Le serveur répond sur l'IP réseau !" -ForegroundColor Green
        Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
    } catch {
        Write-Host "   ❌ Le serveur ne répond pas sur l'IP réseau ($ipAddress) !" -ForegroundColor Red
        Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Cela peut indiquer un problème de réseau ou de configuration." -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Impossible de détecter l'IP réseau 10.135.*" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si localhost fonctionne mais pas l'IP réseau :" -ForegroundColor Yellow
Write-Host "  - Le problème vient du réseau ou du hotspot" -ForegroundColor Yellow
Write-Host "  - Vérifiez que le téléphone et l'ordinateur sont bien connectés" -ForegroundColor Yellow
Write-Host ""
Write-Host "Si localhost ne fonctionne pas :" -ForegroundColor Yellow
Write-Host "  - Le serveur backend a un problème" -ForegroundColor Yellow
Write-Host "  - Vérifiez les logs du serveur dans le terminal où il est démarré" -ForegroundColor Yellow
Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

