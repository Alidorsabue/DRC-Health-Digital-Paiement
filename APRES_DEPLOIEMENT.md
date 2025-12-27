# Guide: Après le Déploiement sur Railway

Félicitations ! Votre backend et frontend sont maintenant déployés sur Railway. Voici les prochaines étapes.

## ✅ Vérification du Déploiement

### 1. Vérifier que le Backend fonctionne

1. **Récupérez l'URL du backend** :
   - Allez dans Railway → Votre service backend
   - Settings → Networking → Copiez l'URL (ex: `https://votre-backend.up.railway.app`)

2. **Testez l'API** :
   - Ouvrez dans votre navigateur : `https://votre-backend.up.railway.app/api`
   - Vous devriez voir la documentation Swagger
   - Testez quelques endpoints pour vérifier que l'API fonctionne

### 2. Vérifier que le Frontend fonctionne

1. **Récupérez l'URL du frontend** :
   - Allez dans Railway → Votre service frontend
   - Settings → Networking → Copiez l'URL (ex: `https://votre-frontend.up.railway.app`)

2. **Testez le frontend** :
   - Ouvrez l'URL dans votre navigateur
   - Vous devriez voir la page de connexion
   - Essayez de vous connecter

## 🔧 Configuration Post-Déploiement

### 1. Exécuter les Migrations de Base de Données

Les tables de la base de données doivent être créées. Exécutez les migrations :

**Via Railway CLI** (recommandé) :
```bash
# Installer Railway CLI si pas déjà fait
npm i -g @railway/cli

# Se connecter
railway login

# Lier le projet
railway link

# Exécuter les migrations
cd backend
railway run npm run migration:run
```

**Note**: Si vous n'avez pas de script `migration:run`, vous pouvez utiliser TypeORM en mode synchronisation temporairement (voir ci-dessous).

### 2. Créer le Premier Utilisateur SuperAdmin

Après les migrations, créez votre premier utilisateur administrateur :

**Via l'API Swagger** :
1. Allez sur `https://votre-backend.up.railway.app/api`
2. Utilisez l'endpoint `/users` (POST)
3. Créez un utilisateur avec le rôle `SUPERADMIN`

**Via curl** :
```bash
curl -X POST https://votre-backend.up.railway.app/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "VotreMotDePasseSecurise123!",
    "email": "admin@example.com",
    "fullName": "Administrateur",
    "role": "SUPERADMIN",
    "scope": "NATIONAL"
  }'
```

**Note**: Vous devrez peut-être temporairement désactiver les guards d'authentification pour créer le premier utilisateur.

### 3. Configurer les Variables d'Environnement

Vérifiez que toutes les variables sont correctement configurées :

**Backend** :
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` (automatiques avec Railway PostgreSQL)
- `JWT_SECRET` (changez-le par une valeur sécurisée)
- `JWT_EXPIRES_IN=7d`
- `NODE_ENV=production`
- `FRONTEND_URL=https://votre-frontend.up.railway.app`

**Frontend** :
- `NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app` (remplacez par votre URL backend)
- `NODE_ENV=production`
- `PORT=${{PORT}}`

**⚠️ IMPORTANT**: La variable `NEXT_PUBLIC_API_URL` doit être configurée dans Railway → Service Frontend → Settings → Variables. Sinon, le frontend utilisera `http://localhost:3001` par défaut.

### 4. Vérifier la Connexion Frontend ↔ Backend

1. Ouvrez le frontend dans votre navigateur
2. Ouvrez la console développeur (F12)
3. Essayez de vous connecter
4. Vérifiez qu'il n'y a pas d'erreurs CORS ou de connexion

## 📱 Configuration de l'Application Mobile

### 1. Mettre à jour l'URL de l'API

1. Ouvrez `mobile/lib/config/app_config.dart`
2. Modifiez l'URL par défaut :
```dart
static const String defaultApiUrl = 'https://votre-backend.up.railway.app';
```

### 2. Construire l'APK

**Windows PowerShell** :
```powershell
.\mobile\build-apk.ps1
```

**Linux/macOS** :
```bash
chmod +x mobile/build-apk.sh
./mobile/build-apk.sh
```

L'APK sera généré dans : `mobile/build/app/outputs/flutter-apk/app-release.apk`

### 3. Installer l'APK

```bash
# Via ADB
adb install mobile\build\app\outputs\flutter-apk\app-release.apk

# Ou transférez manuellement l'APK sur votre appareil Android
```

## 🧪 Tests de Validation

### Test 1: Backend API
- [ ] Swagger accessible : `https://votre-backend.up.railway.app/api`
- [ ] Endpoint `/auth/login` fonctionne
- [ ] Endpoint `/users` fonctionne (avec authentification)
- [ ] Base de données connectée (pas d'erreurs dans les logs)

### Test 2: Frontend Web
- [ ] Page de connexion accessible
- [ ] Connexion fonctionne
- [ ] Dashboard accessible après connexion
- [ ] Pas d'erreurs dans la console navigateur

### Test 3: Application Mobile
- [ ] APK installé avec succès
- [ ] Application démarre
- [ ] Connexion à l'API fonctionne
- [ ] Synchronisation des données fonctionne

## 🔐 Sécurité

### Actions Importantes

1. **Changez le JWT_SECRET** :
   - Générez une clé sécurisée aléatoire
   - Mettez à jour dans Railway → Variables

2. **Vérifiez les CORS** :
   - Le backend doit accepter les requêtes du frontend
   - Vérifiez que `FRONTEND_URL` est correctement configuré

3. **Sécurisez les mots de passe** :
   - Utilisez des mots de passe forts pour les utilisateurs
   - Changez les mots de passe par défaut

## 📊 Monitoring

### Vérifier les Logs

**Backend** :
```bash
railway logs --service votre-service-backend
```

**Frontend** :
```bash
railway logs --service votre-service-frontend
```

### Vérifier les Métriques

- Allez dans Railway → Votre service → Metrics
- Vérifiez l'utilisation CPU, RAM, et réseau
- Surveillez les erreurs

## 🐛 Dépannage

### Le Backend ne démarre pas

1. Vérifiez les logs : `railway logs`
2. Vérifiez les variables d'environnement
3. Vérifiez que PostgreSQL est démarré
4. Vérifiez que le port est correctement configuré

### Le Frontend ne se connecte pas au Backend

1. Vérifiez `NEXT_PUBLIC_API_URL` dans les variables d'environnement
2. Vérifiez les CORS dans le backend
3. Vérifiez les logs du backend pour voir les requêtes

### Erreurs de Base de Données

1. Vérifiez que les migrations ont été exécutées
2. Vérifiez les variables de connexion PostgreSQL
3. Vérifiez que PostgreSQL est démarré dans Railway

## 📝 Checklist Complète

- [ ] Backend déployé et accessible
- [ ] Frontend déployé et accessible
- [ ] PostgreSQL créé et connecté
- [ ] Migrations exécutées
- [ ] Premier utilisateur SuperAdmin créé
- [ ] Variables d'environnement configurées
- [ ] Frontend se connecte au backend
- [ ] Application mobile configurée avec la nouvelle URL
- [ ] APK construit
- [ ] Tests de validation réussis
- [ ] JWT_SECRET changé
- [ ] Mots de passe sécurisés

## 🎉 Prochaines Étapes

1. **Tester toutes les fonctionnalités** :
   - Créer des formulaires
   - Enregistrer des prestataires
   - Valider des données
   - Générer des rapports

2. **Configurer un domaine personnalisé** (optionnel) :
   - Dans Railway → Settings → Networking
   - Ajoutez votre propre domaine

3. **Configurer les sauvegardes** :
   - Configurez des sauvegardes automatiques de PostgreSQL
   - Railway propose des sauvegardes automatiques

4. **Optimiser les performances** :
   - Surveillez les métriques
   - Optimisez les requêtes si nécessaire
   - Configurez le cache si nécessaire

## 📚 Ressources

- Documentation Railway: https://docs.railway.app/
- Guide de build APK: `mobile/BUILD_APK.md`
- Guide de déploiement: `RAILWAY_DEPLOYMENT.md`
- Dépannage: `RAILWAY_TROUBLESHOOTING.md`

## 🆘 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans Railway
2. Consultez les guides de dépannage
3. Vérifiez la documentation Railway

Félicitations pour votre déploiement ! 🎉

