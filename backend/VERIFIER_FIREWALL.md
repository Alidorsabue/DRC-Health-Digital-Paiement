# Résolution du problème de timeout - Firewall Windows

## Problème identifié

Le serveur écoute bien sur `0.0.0.0:3001` (confirmé par `netstat`), mais le téléphone ne peut pas s'y connecter. Cela indique que **le firewall Windows bloque les connexions entrantes**.

## Solution : Ouvrir le port 3001 dans le firewall

### Méthode 1 : Script PowerShell automatique (Recommandé)

1. **Ouvrez PowerShell en tant qu'administrateur** :
   - Clic droit sur PowerShell
   - Sélectionnez "Exécuter en tant qu'administrateur"

2. **Naviguez vers le dossier backend** :
   ```powershell
   cd "C:\Users\Helpdesk\OneDrive - AITS\Bureau\MASTER IA DATA SCIENCE DIT\RECHERCHES\MS Paiement digital RDC\backend"
   ```

3. **Exécutez le script** :
   ```powershell
   .\ouvrir_port_firewall.ps1
   ```

### Méthode 2 : Manuellement via l'interface Windows

1. Ouvrez "Pare-feu Windows Defender avec sécurité avancée"
   - Recherchez "firewall" dans le menu Démarrer
   - Cliquez sur "Pare-feu Windows Defender avec sécurité avancée"

2. Cliquez sur "Règles de trafic entrant" dans le panneau de gauche

3. Cliquez sur "Nouvelle règle..." dans le panneau de droite

4. Sélectionnez "Port" et cliquez sur "Suivant"

5. Sélectionnez "TCP" et "Ports locaux spécifiques", puis entrez : `3001`
   - Cliquez sur "Suivant"

6. Sélectionnez "Autoriser la connexion" et cliquez sur "Suivant"

7. Cochez les trois profils (Domaine, Privé, Public) et cliquez sur "Suivant"

8. Nommez la règle : `Backend Port 3001`
   - Ajoutez une description optionnelle : `Autorise les connexions au serveur backend`
   - Cliquez sur "Terminer"

### Méthode 3 : Via PowerShell (commande directe)

Ouvrez PowerShell en tant qu'administrateur et exécutez :

```powershell
New-NetFirewallRule -DisplayName "Backend Port 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

## Vérification

Après avoir ouvert le port, testez :

1. **Depuis le navigateur du téléphone** :
   - Allez à : `http://10.135.194.178:3001/api`
   - Vous devriez voir la documentation Swagger

2. **Depuis l'application mobile** :
   - Réessayez de vous connecter
   - Cela devrait fonctionner maintenant

## Dépannage supplémentaire

### Si ça ne fonctionne toujours pas :

1. **Vérifiez que le serveur est démarré** :
   ```powershell
   netstat -ano | findstr :3001
   ```
   Vous devriez voir : `TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING`

2. **Vérifiez que la règle firewall existe** :
   ```powershell
   Get-NetFirewallRule -DisplayName "Backend Port 3001"
   ```

3. **Testez depuis l'ordinateur lui-même** :
   - Ouvrez un navigateur sur l'ordinateur
   - Allez à : `http://localhost:3001/api`
   - Cela devrait fonctionner

4. **Vérifiez l'IP de l'ordinateur** :
   ```powershell
   ipconfig
   ```
   Confirmez que l'IP est bien `10.135.194.178`

5. **Testez la connexion réseau** :
   - Depuis le téléphone, essayez de `ping` l'ordinateur (si le ping est autorisé)
   - Ou testez avec un autre outil réseau

## Note importante

Le firewall Windows bloque les connexions entrantes par défaut pour des raisons de sécurité. En ouvrant le port 3001, vous autorisez les connexions depuis le réseau local seulement (ce qui est normal pour le développement).

Pour la production, assurez-vous de sécuriser votre serveur avec des mesures appropriées.
















