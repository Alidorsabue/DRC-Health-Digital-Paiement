# Guide: Exécuter les Migrations sur Railway

## 🎯 Objectif

Exécuter les migrations de base de données après le déploiement sur Railway.

## ✅ Méthode 1: Railway CLI (LA PLUS SIMPLE)

### Étape 1: Installer Railway CLI

```bash
npm i -g @railway/cli
```

### Étape 2: Se connecter

```bash
railway login
```

Cela ouvrira votre navigateur pour vous connecter à Railway.

### Étape 3: Lier votre projet

```bash
# Depuis la racine de votre projet
railway link
```

Sélectionnez votre projet et service dans la liste.

### Étape 4: Exécuter les migrations

```bash
# Aller dans le dossier backend
cd backend

# Exécuter les migrations
railway run npm run migration:run
```

**Alternative**: Si vous êtes à la racine du projet:
```bash
railway run --service votre-service-name npm --prefix backend run migration:run
```

## ✅ Méthode 2: Via le Dashboard Railway

### Option A: Terminal dans les Deployments

1. Allez sur Railway: https://railway.app/
2. Sélectionnez votre projet
3. Cliquez sur votre service backend
4. Allez dans l'onglet **"Deployments"**
5. Cliquez sur le dernier déploiement (celui marqué "Active")
6. Cherchez un bouton **"Terminal"**, **"Shell"**, ou **"Connect"**
7. Cliquez dessus pour ouvrir un terminal
8. Exécutez:
```bash
npm run migration:run
```

### Option B: Terminal dans Settings

1. Allez dans **Settings** de votre service
2. Cherchez une section **"Terminal"** ou **"Shell"**
3. Ouvrez le terminal
4. Exécutez les migrations

### Option C: Via les Variables d'Environnement (Script de démarrage)

Vous pouvez créer un script qui exécute les migrations au démarrage:

1. Créez un fichier `backend/start.sh`:
```bash
#!/bin/sh
npm run migration:run
node dist/main.js
```

2. Modifiez le Dockerfile pour utiliser ce script (voir ci-dessous)

## ✅ Méthode 3: Modifier le Dockerfile (Temporaire)

Si vous ne trouvez pas le terminal, vous pouvez temporairement exécuter les migrations au démarrage:

### Modifier le Dockerfile

Ajoutez cette ligne avant `CMD`:

```dockerfile
# Créer un script de démarrage
RUN echo '#!/bin/sh\nnpm run migration:run\nnode dist/main.js' > start.sh && chmod +x start.sh

# Utiliser le script au démarrage
CMD ["sh", "start.sh"]
```

**⚠️ Attention**: Cette méthode exécute les migrations à chaque redémarrage. Retirez cette modification après la première exécution.

## ✅ Méthode 4: Via un Script de Migration Séparé

Créez un script qui peut être exécuté via Railway CLI:

### Créer `backend/run-migrations.sh`

```bash
#!/bin/sh
echo "Exécution des migrations..."
npm run migration:run
echo "Migrations terminées!"
```

### Exécuter via Railway CLI

```bash
railway run sh backend/run-migrations.sh
```

## 🔍 Vérifier que les Migrations ont Réussi

### Via Railway CLI

```bash
# Voir les logs
railway logs

# Voir les logs en temps réel
railway logs --follow
```

### Via Dashboard

1. Allez dans **Deployments**
2. Cliquez sur le dernier déploiement
3. Regardez les **Deploy Logs**
4. Cherchez des messages comme "Migration successful" ou des erreurs

## 🐛 Dépannage

### "railway: command not found"

```bash
# Réinstaller Railway CLI
npm i -g @railway/cli

# Vérifier l'installation
railway --version
```

### "No project linked"

```bash
# Lier le projet
railway link

# Ou spécifier le projet explicitement
railway run --project votre-project-id npm run migration:run
```

### "Cannot connect to database"

Vérifiez que les variables d'environnement sont correctement configurées:
- `DB_HOST=${{Postgres.PGHOST}}`
- `DB_PORT=${{Postgres.PGPORT}}`
- `DB_USERNAME=${{Postgres.PGUSER}}`
- `DB_PASSWORD=${{Postgres.PGPASSWORD}}`
- `DB_NAME=${{Postgres.PGDATABASE}}`

### Les migrations échouent

1. Vérifiez les logs: `railway logs`
2. Vérifiez que PostgreSQL est démarré
3. Vérifiez que les variables d'environnement sont correctes
4. Essayez d'exécuter une migration simple pour tester la connexion

## 📝 Commandes Utiles Railway CLI

```bash
# Voir l'état du service
railway status

# Voir les variables d'environnement
railway variables

# Voir les logs
railway logs

# Exécuter une commande
railway run <commande>

# Ouvrir un shell interactif
railway shell
```

## ✅ Checklist

- [ ] Railway CLI installé
- [ ] Connecté à Railway (`railway login`)
- [ ] Projet lié (`railway link`)
- [ ] Variables d'environnement configurées
- [ ] PostgreSQL démarré et accessible
- [ ] Migrations exécutées avec succès
- [ ] Vérifié les logs pour confirmer

## 🆘 Si Rien ne Fonctionne

1. **Vérifiez que PostgreSQL est bien démarré**:
   - Allez dans votre service PostgreSQL sur Railway
   - Vérifiez qu'il est "Active"

2. **Testez la connexion manuellement**:
   ```bash
   railway run node -e "console.log(process.env.DB_HOST)"
   ```

3. **Exécutez une migration simple pour tester**:
   ```bash
   railway run npm --prefix backend run migration:run
   ```

4. **Contactez le support Railway** si le problème persiste

## 📚 Ressources

- Documentation Railway CLI: https://docs.railway.app/develop/cli
- Guide des migrations TypeORM: https://typeorm.io/migrations

