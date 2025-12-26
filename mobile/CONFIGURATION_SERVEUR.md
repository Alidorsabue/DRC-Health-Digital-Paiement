# Configuration de l'URL du serveur

## Problème

L'application mobile ne peut pas se connecter au serveur car `localhost` ne fonctionne pas sur un appareil mobile. Vous devez utiliser l'adresse IP de votre ordinateur de développement.

## Solution

### Étape 1 : Trouver l'adresse IP de votre ordinateur

#### Sur Windows :
1. Ouvrez l'invite de commandes (cmd)
2. Tapez : `ipconfig`
3. Cherchez "Adresse IPv4" sous votre connexion réseau active
4. Exemple : `192.168.1.100`

#### Sur Mac/Linux :
1. Ouvrez le terminal
2. Tapez : `ifconfig` ou `ip addr`
3. Cherchez l'adresse IP de votre interface réseau

### Étape 2 : Configurer l'URL dans l'application

1. **Sur l'écran de connexion**, cliquez sur "Configurer l'URL du serveur"
2. Entrez l'URL dans le format : `http://VOTRE_IP:3001`
   - Exemple : `http://192.168.1.100:3001`
3. Cliquez sur "Sauvegarder l'URL"
4. Réessayez de vous connecter

### Cas spéciaux

#### Émulateur Android :
- Utilisez : `http://10.0.2.2:3001`
- Cette adresse spéciale redirige vers `localhost` de votre ordinateur

#### Appareil physique connecté en USB :
- Utilisez l'adresse IP de votre ordinateur : `http://192.168.1.100:3001`

#### Appareil sur le même réseau Wi-Fi :
- Utilisez l'adresse IP de votre ordinateur sur ce réseau

### Étape 3 : Vérifier que le serveur est accessible

1. Assurez-vous que votre serveur backend est démarré
2. Vérifiez que le firewall n'bloque pas le port 3001
3. Testez l'URL dans un navigateur sur votre téléphone : `http://VOTRE_IP:3001`

## Configuration via les paramètres

Vous pouvez aussi configurer l'URL du serveur dans les paramètres de l'application (après connexion) :
1. Allez dans les paramètres (icône d'engrenage)
2. Modifiez l'URL de l'API
3. Sauvegardez

## Exemples d'URL

- Local (émulateur Android) : `http://10.0.2.2:3001`
- Réseau local : `http://192.168.1.100:3001`
- Serveur de production : `https://votre-serveur.com`

## Dépannage

### Erreur "Impossible de se connecter au serveur"
- Vérifiez que le serveur backend est démarré
- Vérifiez que l'adresse IP est correcte
- Vérifiez que l'appareil et l'ordinateur sont sur le même réseau
- Vérifiez le firewall Windows/Mac

### Erreur "Timeout"
- Vérifiez la connexion internet
- Vérifiez que le port 3001 n'est pas bloqué
- Augmentez le timeout dans les paramètres si nécessaire
















