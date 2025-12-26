# Configuration lorsque le téléphone partage la connexion (Hotspot)

## Situation

Votre téléphone partage sa connexion internet avec votre ordinateur. Dans ce cas, la configuration est différente.

## Architecture réseau

```
[Téléphone (Hotspot)] ← partage internet
    ↓
[Ordinateur connecté au hotspot] ← serveur backend ici
```

## Configuration

### Étape 1 : Trouver l'adresse IP de l'ordinateur connecté au hotspot

#### Sur Windows :

1. Ouvrez PowerShell ou l'invite de commandes
2. Tapez : `ipconfig`
3. Cherchez la connexion qui correspond au hotspot du téléphone
   - Généralement nommée "Connexion réseau sans fil" ou "Wi-Fi"
   - Ou "Connexion au réseau local"
4. Notez l'**Adresse IPv4** de cette connexion
   - Exemple : `192.168.43.150` ou `192.168.137.2`

#### Note importante :
- L'adresse IP du téléphone (hotspot) est généralement : `192.168.43.1`
- L'adresse IP de l'ordinateur sera : `192.168.43.XXX` (où XXX est un nombre entre 2 et 254)

### Étape 2 : Configurer l'URL dans l'application mobile

1. **Sur l'écran de connexion**, cliquez sur "Configurer l'URL du serveur"
2. Entrez l'URL dans le format : `http://IP_ORDINATEUR:3001`
   - Exemple : `http://192.168.43.150:3001`
3. Cliquez sur "Sauvegarder l'URL"
4. Réessayez de vous connecter

### Étape 3 : Vérifier que le serveur est accessible

1. Sur l'ordinateur, assurez-vous que le serveur backend écoute sur **0.0.0.0:3001** et non **localhost:3001**
   - Le serveur doit écouter sur toutes les interfaces réseau, pas seulement localhost

2. Vérifiez le firewall Windows :
   - Autorisez les connexions entrantes sur le port 3001
   - Ou désactivez temporairement le firewall pour tester

3. Testez depuis le téléphone :
   - Ouvrez un navigateur sur le téléphone
   - Allez à : `http://IP_ORDINATEUR:3001`
   - Vous devriez voir une réponse du serveur

## Configuration du serveur backend

### Important : Le serveur doit écouter sur 0.0.0.0

Votre serveur backend doit être configuré pour écouter sur **toutes les interfaces réseau**, pas seulement localhost :

#### Exemple avec Node.js/Express :
```javascript
const app = express();
app.listen(3001, '0.0.0.0', () => {
  console.log('Server listening on 0.0.0.0:3001');
});
```

#### Ou simplement :
```javascript
app.listen(3001, () => {
  console.log('Server listening on port 3001');
});
// Par défaut, Node.js écoute sur 0.0.0.0
```

### Vérifier que le serveur écoute correctement

Sur Windows, tapez dans PowerShell :
```powershell
netstat -ano | findstr :3001
```

Vous devriez voir quelque chose comme :
```
TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING
```

Si vous voyez seulement `127.0.0.1:3001`, le serveur n'écoute que sur localhost et ne sera pas accessible depuis le téléphone.

## Dépannage

### Erreur "Timeout de connexion"
- Vérifiez que l'IP de l'ordinateur est correcte
- Vérifiez que le serveur écoute sur 0.0.0.0:3001 (pas seulement localhost)
- Vérifiez le firewall Windows

### Erreur "Connection refused"
- Le serveur n'est pas démarré
- Le port 3001 est bloqué par le firewall
- L'IP utilisée est incorrecte

### Comment tester la connexion

1. Sur le téléphone, ouvrez un navigateur
2. Allez à : `http://IP_ORDINATEUR:3001/api/health` (ou un endpoint de test)
3. Si cela fonctionne dans le navigateur, cela fonctionnera dans l'app

## Résumé rapide

1. Trouvez l'IP de l'ordinateur : `ipconfig` (Windows)
2. Configurez le serveur pour écouter sur `0.0.0.0:3001`
3. Dans l'app mobile : `http://IP_ORDINATEUR:3001`
4. Autorisez le port 3001 dans le firewall Windows
















