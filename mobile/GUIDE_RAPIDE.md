# Guide rapide - Utiliser Flutter

## Chemin Flutter configuré

Votre Flutter se trouve à :
```
C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin
```

## Option 1 : Utilisation temporaire (sans modifier le PATH)

Pour utiliser Flutter dans cette session PowerShell uniquement :

```powershell
.\use_flutter_direct.ps1
```

Puis vous pouvez utiliser `flutter` normalement dans cette session.

## Option 2 : Configuration permanente (recommandé)

Pour configurer Flutter de façon permanente :

1. **Exécutez le script de correction :**
   ```powershell
   .\fix_flutter_path.ps1
   ```

2. **Redémarrez PowerShell complètement**

3. **Vérifiez que ça fonctionne :**
   ```powershell
   flutter --version
   ```

4. **Installez les dépendances :**
   ```powershell
   .\install.ps1
   ```

## Option 3 : Utilisation manuelle avec chemin complet

Si vous ne voulez pas modifier le PATH, utilisez le chemin complet :

```powershell
& "C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin\flutter.bat" --version
& "C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin\flutter.bat" pub get
```

## Test rapide

Pour tester si Flutter fonctionne :

```powershell
.\test_flutter.ps1
```

## Prochaines étapes

Une fois Flutter configuré :

1. Installez les dépendances : `.\install.ps1`
2. Lancez l'application : `flutter run`


















