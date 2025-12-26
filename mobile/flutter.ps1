# Wrapper PowerShell pour Flutter - utilise le chemin direct

$flutterBin = "C:\Program Files\flutter\bin"
$flutterBat = "$flutterBin\flutter.bat"

# Verifier que Flutter existe
if (-not (Test-Path $flutterBat)) {
    Write-Host "ERREUR: Flutter non trouve a : $flutterBat" -ForegroundColor Red
    exit 1
}

# Aller dans le repertoire du script (mobile)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Executer Flutter avec les arguments passes
$arguments = $args -join ' '

# Pour la commande create, il faut etre dans le repertoire du projet
if ($arguments -like "*create*") {
    # Executer depuis le repertoire du projet (mobile)
    Push-Location $scriptPath
    $result = cmd /c "`"$flutterBat`" $arguments" 2>&1
    Pop-Location
    Write-Host $result
    $exitCode = $LASTEXITCODE
} else {
    # Pour les autres commandes, executer depuis le bin de Flutter
    Push-Location $flutterBin
    cmd /c "flutter.bat $arguments"
    $exitCode = $LASTEXITCODE
    Pop-Location
}

exit $exitCode

