# Script de verification de l'installation Flutter

Write-Host "=== Verification de l'installation Flutter ===" -ForegroundColor Cyan
Write-Host ""

# Verifier si Flutter est dans le PATH
Write-Host "1. Verification du PATH..." -ForegroundColor Yellow
$flutterCmd = Get-Command flutter -ErrorAction SilentlyContinue

if ($flutterCmd) {
    $flutterSource = $flutterCmd.Source
    Write-Host "   Flutter trouve : $flutterSource" -ForegroundColor Yellow
    
    # Verifier si c'est un vrai Flutter ou un faux
    if ($flutterSource -like "*system32*" -or $flutterSource -notlike "*flutter*") {
        Write-Host "   ATTENTION: Ce n'est pas le vrai SDK Flutter !" -ForegroundColor Red
        Write-Host "   Le vrai Flutter devrait etre dans un dossier flutter\bin" -ForegroundColor Yellow
        
        # Tester si la commande fonctionne vraiment
        Write-Host "   Test de la commande..." -ForegroundColor Yellow
        try {
            $testResult = flutter --version 2>&1 | Out-String
            if ($testResult -match "Flutter|flutter") {
                Write-Host "   OK La commande fonctionne" -ForegroundColor Green
            } else {
                Write-Host "   ERREUR La commande ne fonctionne pas correctement" -ForegroundColor Red
            }
        } catch {
            Write-Host "   ERREUR Impossible d'executer flutter" -ForegroundColor Red
        }
    } else {
        Write-Host "   OK Flutter valide trouve : $flutterSource" -ForegroundColor Green
    }
} else {
    Write-Host "   ERREUR Flutter non trouve dans le PATH" -ForegroundColor Red
}

# Verifier les emplacements communs
Write-Host ""
Write-Host "2. Recherche dans les emplacements communs..." -ForegroundColor Yellow
$commonPaths = @(
    "$env:LOCALAPPDATA\flutter",
    "$env:ProgramFiles\flutter",
    "C:\Program Files\Flutter\flutter",
    "C:\Program Files\flutter",
    "C:\src\flutter",
    "C:\flutter",
    "$env:USERPROFILE\flutter"
)

$foundPaths = @()
foreach ($path in $commonPaths) {
    if (Test-Path "$path\bin\flutter.bat") {
        Write-Host "   OK Trouve : $path\bin" -ForegroundColor Green
        $foundPaths += "$path\bin"
    }
}

if ($foundPaths.Count -eq 0) {
    Write-Host "   ERREUR Aucun Flutter trouve dans les emplacements communs" -ForegroundColor Red
}

# Verifier la variable d'environnement FLUTTER_ROOT
Write-Host ""
Write-Host "3. Verification de FLUTTER_ROOT..." -ForegroundColor Yellow
if ($env:FLUTTER_ROOT) {
    Write-Host "   OK FLUTTER_ROOT = $env:FLUTTER_ROOT" -ForegroundColor Green
    if (Test-Path "$env:FLUTTER_ROOT\bin\flutter.bat") {
        Write-Host "   OK Flutter valide a cet emplacement" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR Flutter non trouve a cet emplacement" -ForegroundColor Red
    }
} else {
    Write-Host "   INFO FLUTTER_ROOT non defini" -ForegroundColor Yellow
}

# Tester la commande flutter
Write-Host ""
Write-Host "4. Test de la commande flutter..." -ForegroundColor Yellow

# Essayer avec le chemin direct si trouve dans les emplacements communs
$directFlutterPath = $null
if ($foundPaths.Count -gt 0) {
    $directFlutterPath = $foundPaths[0] + "\flutter.bat"
    Write-Host "   Test avec le chemin direct : $directFlutterPath" -ForegroundColor Gray
    if (Test-Path $directFlutterPath) {
        try {
            $version = & $directFlutterPath --version 2>&1 | Select-Object -First 1
            if ($LASTEXITCODE -eq 0 -or $version -match "Flutter") {
                Write-Host "   OK Flutter fonctionne avec le chemin direct : $version" -ForegroundColor Green
            }
        } catch {
            Write-Host "   ERREUR avec le chemin direct" -ForegroundColor Red
        }
    }
}

# Tester avec la commande flutter du PATH
try {
    $version = flutter --version 2>&1 | Select-Object -First 1
    if ($LASTEXITCODE -eq 0 -or $version -match "Flutter") {
        Write-Host "   OK Flutter fonctionne via PATH : $version" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR lors de l'execution de flutter via PATH" -ForegroundColor Red
    }
} catch {
    Write-Host "   ERREUR Impossible d'executer flutter via PATH" -ForegroundColor Red
    Write-Host "   Erreur : $_" -ForegroundColor Red
    
    if ($foundPaths.Count -gt 0) {
        Write-Host ""
        Write-Host "   SOLUTION: Utilisez le chemin direct ou ajoutez au PATH :" -ForegroundColor Yellow
        foreach ($path in $foundPaths) {
            Write-Host "   $path" -ForegroundColor Cyan
        }
    }
}

# Resume et recommandations
Write-Host ""
Write-Host "=== Resume ===" -ForegroundColor Cyan

$flutterWorks = $false
if ($flutterCmd) {
    $flutterSource = $flutterCmd.Source
    if ($flutterSource -notlike "*system32*" -and $flutterSource -like "*flutter*") {
        Write-Host "Flutter est correctement installe et configure !" -ForegroundColor Green
        $flutterWorks = $true
    } else {
        Write-Host "ATTENTION: Un faux Flutter est dans le PATH (system32)" -ForegroundColor Yellow
        Write-Host ""
        if ($foundPaths.Count -gt 0) {
            Write-Host "Le vrai Flutter se trouve a :" -ForegroundColor Yellow
            foreach ($path in $foundPaths) {
                Write-Host "   $path" -ForegroundColor Cyan
            }
            Write-Host ""
            Write-Host "SOLUTION: Ajoutez ce chemin au DEBUT du PATH systeme" -ForegroundColor Yellow
            Write-Host "Ou supprimez le faux flutter de system32 du PATH" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Flutter n'est pas dans le PATH." -ForegroundColor Red
    if ($foundPaths.Count -gt 0) {
        Write-Host ""
        Write-Host "Flutter trouve mais pas dans le PATH. Ajoutez au PATH :" -ForegroundColor Yellow
        foreach ($path in $foundPaths) {
            Write-Host "   $path" -ForegroundColor Cyan
        }
    } else {
        Write-Host ""
        Write-Host "Pour installer Flutter :" -ForegroundColor Yellow
        Write-Host "1. Telechargez depuis : https://flutter.dev/docs/get-started/install/windows" -ForegroundColor White
        Write-Host "2. Extrayez dans un dossier (ex: C:\src\flutter)" -ForegroundColor White
        Write-Host "3. Ajoutez le dossier \bin au PATH systeme" -ForegroundColor White
        Write-Host "4. Redemarrez PowerShell" -ForegroundColor White
    }
}

if (-not $flutterWorks -and $foundPaths.Count -gt 0) {
    Write-Host ""
    Write-Host "Pour corriger le PATH rapidement, executez :" -ForegroundColor Cyan
    Write-Host "   .\fix_flutter_path.ps1" -ForegroundColor White
}

Write-Host ""
pause
