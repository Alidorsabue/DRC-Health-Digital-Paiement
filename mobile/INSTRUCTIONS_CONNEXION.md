# Instructions de connexion - Configuration actuelle

## ✅ Votre configuration

- **Adresse IP de l'ordinateur** : `10.135.194.178`
- **Port du serveur** : `3001`
- **URL complète** : `http://10.135.194.178:3001`

## 📱 Configuration dans l'application mobile

1. **Sur l'écran de connexion**, vous verrez le bouton "Configurer l'URL du serveur"
2. L'URL par défaut est maintenant : `http://10.135.194.178:3001`
3. Si vous devez la modifier, cliquez sur "Configurer l'URL du serveur" et entrez : `http://10.135.194.178:3001`
4. Cliquez sur "Sauvegarder l'URL"
5. Entrez vos identifiants et connectez-vous

## ⚙️ Vérifications importantes

### 1. Le serveur backend doit écouter sur toutes les interfaces

Le fichier `backend/src/main.ts` a été modifié pour écouter sur `0.0.0.0:3001` au lieu de `localhost:3001`. Cela permet au serveur d'être accessible depuis le réseau.

### 2. Vérifier que le serveur backend est démarré

Dans le dossier `backend`, exécutez :
```bash
npm run start:dev
```

Vous devriez voir :
```
Application is running on: http://0.0.0.0:3001
Network access: http://10.135.194.178:3001
```

### 3. Vérifier le firewall Windows

Le firewall Windows peut bloquer les connexions entrantes. Pour autoriser le port 3001 :

1. Ouvrez "Pare-feu Windows Defender" dans les paramètres
2. Cliquez sur "Paramètres avancés"
3. Cliquez sur "Règles de trafic entrant"
4. Créez une nouvelle règle pour le port 3001 (TCP)

Ou temporairement, désactivez le firewall pour tester.

### 4. Tester la connexion depuis le téléphone

1. Sur votre téléphone, ouvrez un navigateur (Chrome, etc.)
2. Allez à : `http://10.135.194.178:3001/api`
3. Si vous voyez la documentation Swagger, la connexion fonctionne !

## 🔧 Dépannage

### Erreur "Timeout de connexion"
- Vérifiez que le serveur backend est démarré
- Vérifiez que le firewall Windows autorise le port 3001
- Vérifiez que l'URL dans l'app est bien `http://10.135.194.178:3001`

### Erreur "Connection refused"
- Le serveur n'est pas démarré
- Le port 3001 est bloqué par le firewall
- L'IP a peut-être changé (exécutez `ipconfig` à nouveau)

### Si l'IP change
Si l'adresse IP de votre ordinateur change (par exemple après une reconnexion au hotspot), vous devrez :
1. Exécuter `ipconfig` à nouveau
2. Noter la nouvelle adresse IPv4
3. Mettre à jour l'URL dans l'application mobile

## ✅ Résumé

1. **URL à utiliser** : `http://10.135.194.178:3001`
2. **Configurer dans l'app** : Cliquez sur "Configurer l'URL du serveur" et entrez cette URL
3. **Vérifier le serveur** : Assurez-vous qu'il écoute sur `0.0.0.0:3001`
4. **Vérifier le firewall** : Autorisez le port 3001
5. **Tester** : Essayez d'accéder à `http://10.135.194.178:3001/api` depuis le navigateur du téléphone
















