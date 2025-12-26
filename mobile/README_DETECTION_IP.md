# Détection automatique de l'IP du serveur

## Fonctionnalité implémentée

L'application mobile détecte automatiquement l'URL du serveur backend selon l'environnement :

### Pour un émulateur Android
- Utilise automatiquement : `http://10.0.2.2:3001`
- `10.0.2.2` est l'adresse spéciale qui redirige vers `localhost` du PC hôte

### Pour un appareil physique
- Utilise une IP par défaut dans l'ordre de priorité :
  1. `192.168.56.1` (Interface Ethernet virtuelle - testée et fonctionnelle)
  2. `10.135.194.178` (IP hotspot précédente)
  3. `192.168.1.100` (IP réseau local typique)
  4. `192.168.0.100` (Autre IP réseau local typique)

## Configuration manuelle

L'utilisateur peut toujours configurer manuellement l'URL du serveur :

### Sur l'écran de connexion
1. Cliquez sur "Configurer l'URL du serveur"
2. Des boutons avec les IPs disponibles apparaissent
3. Cliquez sur une IP pour la sélectionner automatiquement
4. Ou entrez une URL personnalisée
5. Cliquez sur "Sauvegarder l'URL"

### Dans les paramètres
1. Allez dans les paramètres de l'application
2. Modifiez l'URL de l'API
3. Des boutons avec les IPs disponibles sont disponibles pour sélection rapide

## Fichiers modifiés

- `mobile/lib/utils/network_utils.dart` : Nouvelle classe pour la détection réseau
- `mobile/lib/screens/login_screen.dart` : Intégration de la détection automatique
- `mobile/lib/main.dart` : Utilisation de la détection au démarrage
- `mobile/lib/screens/settings_screen.dart` : Intégration dans les paramètres

## Améliorations futures

Pour une détection encore plus précise, vous pouvez :

1. **Installer device_info_plus** pour détecter précisément les émulateurs :
   ```yaml
   dependencies:
     device_info_plus: ^9.1.0
   ```

2. **Utiliser network_info_plus** pour détecter l'IP du réseau actuel :
   ```yaml
   dependencies:
     network_info_plus: ^4.0.0
   ```

3. **Implémenter un scan réseau** pour trouver automatiquement le serveur backend

## Utilisation

L'application détecte automatiquement l'URL au démarrage. Si vous devez changer l'URL :

1. Utilisez les boutons de sélection rapide dans la configuration
2. Ou entrez manuellement l'URL
3. L'URL est sauvegardée et réutilisée au prochain démarrage
















