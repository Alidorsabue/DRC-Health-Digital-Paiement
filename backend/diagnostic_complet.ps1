# Script de diagnostic complet pour le problème de connexion

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC COMPLET - SERVEUR BACKEND" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier le port
Write-Host "[1/6] Vérification du port 3001..." -ForegroundColor Yellow
$portCheck = netstat -ano | findstr ":3001" | findstr "LISTENING"
if ($portCheck) {
    Write-Host "   ✅ Port 3001 en écoute" -ForegroundColor Green
    Write-Host "   $portCheck" -ForegroundColor Gray
} else {
    Write-Host "   ❌ Port 3001 NON en écoute !" -ForegroundColor Red
    Write-Host "   → Le serveur backend n'est pas démarré." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   SOLUTION: Démarrez le serveur avec 'npm run start:dev' dans le dossier backend" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 2. Vérifier l'IP
Write-Host "[2/6] Vérification de l'adresse IP..." -ForegroundColor Yellow
$ipConfig = ipconfig
$wirelessIP = $ipConfig | Select-String "Carte réseau sans fil" -Context 0,10 | Select-String "IPv4"
if ($wirelessIP) {
    Write-Host "   ✅ Adresse IP trouvée:" -ForegroundColor Green
    $wirelessIP | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   ⚠️  Impossible de trouver l'IP Wi-Fi" -ForegroundColor Yellow
}
Write-Host ""

# 3. Test localhost
Write-Host "[3/6] Test de connexion à localhost:3001..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Le serveur répond sur localhost !" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Le serveur ne répond PAS sur localhost !" -ForegroundColor Red
    Write-Host "   Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   → Le serveur backend a un problème. Vérifiez les logs." -ForegroundColor Yellow
    Write-Host "   → Testez manuellement: http://localhost:3001/api dans votre navigateur" -ForegroundColor Yellow
}
Write-Host ""

# 4. Test IP réseau
Write-Host "[4/6] Test de connexion à l'IP réseau..." -ForegroundColor Yellow
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -like "10.*" -or $_.IPAddress -like "192.*" 
} | Select-Object -ExpandProperty IPAddress

if ($ips.Count -eq 0) {
    Write-Host "   ⚠️  Aucune IP réseau détectée" -ForegroundColor Yellow
} else {
    foreach ($ip in $ips) {
        Write-Host "   Test avec IP: $ip" -ForegroundColor Gray
        try {
            $response = Invoke-WebRequest -Uri "http://${ip}:3001/api" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            Write-Host "   ✅ Répond sur $ip !" -ForegroundColor Green
        } catch {
            Write-Host "   ❌ Ne répond PAS sur $ip" -ForegroundColor Red
            Write-Host "      Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}
Write-Host ""

# 5. Vérifier firewall
Write-Host "[5/6] Vérification du firewall..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Backend Port 3001" -ErrorAction SilentlyContinue
if ($firewallRule) {
    $enabled = ($firewallRule | Get-NetFirewallPortFilter).LocalPort -contains "3001"
    Write-Host "   ✅ Règle firewall 'Backend Port 3001' existe" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Règle firewall 'Backend Port 3001' non trouvée" -ForegroundColor Yellow
    Write-Host "   → Vous pouvez créer la règle avec: .\ouvrir_port_firewall.ps1" -ForegroundColor Yellow
}
Write-Host ""

# 6. Résumé et recommandations
Write-Host "[6/6] Résumé et recommandations" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "VÉRIFICATIONS À FAIRE:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Sur l'ordinateur, ouvrez un navigateur et allez à:" -ForegroundColor White
Write-Host "   http://localhost:3001/api" -ForegroundColor Cyan
Write-Host "   → Si ça ne marche pas, le serveur a un problème" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Vérifiez que le serveur backend est démarré:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Cyan
Write-Host "   npm run start:dev" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Vérifiez l'IP actuelle de l'ordinateur:" -ForegroundColor White
Write-Host "   ipconfig" -ForegroundColor Cyan
Write-Host ""

Write-Host "4. Testez depuis le navigateur du téléphone:" -ForegroundColor White
Write-Host "   http://[IP_ORDINATEUR]:3001/api" -ForegroundColor Cyan
Write-Host "   (Remplacez [IP_ORDINATEUR] par l'IP trouvée avec ipconfig)" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Si le timeout persiste, le problème peut venir:" -ForegroundColor White
Write-Host "   - Du réseau hotspot (restrictions)" -ForegroundColor Gray
Write-Host "   - D'un antivirus qui bloque" -ForegroundColor Gray
Write-Host "   - De la configuration du hotspot du téléphone" -ForegroundColor Gray
Write-Host ""

Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
















