# Script pour corriger le PATH Flutter

Write-Host "=== Correction du PATH Flutter ===" -ForegroundColor Cyan
Write-Host ""

# Chemin Flutter correct
$flutterPath = "C:\Program Files\flutter\bin"

# Verifier que Flutter existe a cet emplacement
if (Test-Path "$flutterPath\flutter.bat") {
    Write-Host "OK Flutter trouve a : $flutterPath" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Flutter non trouve a : $flutterPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez le chemin et modifiez ce script si necessaire" -ForegroundColor Yellow
    pause
    exit 1
}

# Obtenir le PATH utilisateur actuel
Write-Host ""
Write-Host "Modification du PATH utilisateur..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathEntries = $currentPath -split ';' | Where-Object { $_ -ne '' }

# Supprimer tous les chemins Flutter existants (y compris system32)
$newPathEntries = @()
foreach ($entry in $pathEntries) {
    if ($entry -notlike "*flutter*" -and $entry -ne "C:\WINDOWS\system32") {
        $newPathEntries += $entry
    } elseif ($entry -like "*flutter*" -and $entry -notlike "*system32*") {
        Write-Host "Suppression de l'ancien chemin Flutter : $entry" -ForegroundColor Yellow
    }
}

# Ajouter le nouveau chemin Flutter au DEBUT pour qu'il soit prioritaire
$newPathEntries = @($flutterPath) + $newPathEntries
$newPath = $newPathEntries -join ';'

try {
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host ""
    Write-Host "OK PATH mis a jour avec succes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nouveau chemin Flutter ajoute au DEBUT du PATH :" -ForegroundColor Green
    Write-Host "   $flutterPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "IMPORTANT: Redemarrez PowerShell pour que les changements prennent effet !" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Apres avoir redemarre PowerShell, testez avec :" -ForegroundColor Cyan
    Write-Host "   flutter --version" -ForegroundColor White
    Write-Host "   .\install.ps1" -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "ERREUR: Impossible de mettre a jour le PATH" -ForegroundColor Red
    Write-Host "Erreur : $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vous devez ajouter manuellement ce chemin au DEBUT du PATH :" -ForegroundColor Yellow
    Write-Host "   $flutterPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Et supprimer C:\WINDOWS\system32\flutter du PATH si present" -ForegroundColor Yellow
}

Write-Host ""
pause
