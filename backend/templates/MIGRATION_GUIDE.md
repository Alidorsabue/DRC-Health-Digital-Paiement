# Guide de Migration des Colonnes Géographiques

Ce guide explique comment migrer les colonnes géographiques des formulaires existants vers la nouvelle nomenclature standardisée.

## Nouvelle Nomenclature

**Ancienne nomenclature** → **Nouvelle nomenclature** :
- `admin1_h_c` → `provinceId`
- `admin2_h_c` → `antenneId`
- `admin3_h_c` → `zoneId`
- `admin4_h_c` → `aireId`

## Commande de Migration

Pour migrer automatiquement toutes les tables `form_*` :

```bash
cd backend
npm run migration:form-columns
```

**Note :** Cette commande inclut automatiquement le flag `--yes` pour confirmer la migration.

## Ce que fait le script

Le script de migration :

1. ✅ Se connecte à la base de données PostgreSQL
2. ✅ Trouve toutes les tables `form_*`
3. ✅ Pour chaque table :
   - Vérifie si les colonnes `admin1_h_c`, `admin2_h_c`, `admin3_h_c`, `admin4_h_c` existent
   - Vérifie si les colonnes `provinceId`, `antenneId`, `zoneId`, `aireId` n'existent pas déjà
   - Renomme les colonnes si nécessaire
4. ✅ Affiche un résumé de la migration

## Exemple de Sortie

```
✅ Connexion à la base de données établie

📋 3 tables form_* trouvées

🔄 Migration de la table: form_abc123
   ✓ admin1_h_c → provinceId
   ✓ admin2_h_c → antenneId
   ✓ admin3_h_c → zoneId
   ✓ admin4_h_c → aireId
   ✅ Migration terminée pour form_abc123

🔄 Migration de la table: form_def456
   ✓ Aucune migration nécessaire (colonnes déjà à jour ou absentes)

📊 Résumé de la migration:
   ✅ Succès: 3
   ❌ Erreurs: 0
   📋 Total: 3

✅ Migration terminée
```

## Vérification après Migration

Après avoir exécuté la migration :

1. Vérifiez dans votre base de données que les colonnes ont été renommées :
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'form_VOTRE_FORM_ID'
   AND column_name IN ('provinceId', 'antenneId', 'zoneId', 'aireId');
   ```

2. Testez les filtres dans le dashboard - ils devraient maintenant fonctionner correctement

## Alternative : Republier le Formulaire

Si vous préférez ne pas utiliser le script de migration, vous pouvez :

1. Modifier votre XLSForm pour utiliser `provinceId`, `antenneId`, `zoneId`, `aireId`
2. Le republier dans le système
3. Le système créera automatiquement les colonnes avec les nouveaux noms

## Support

Le système supporte les deux nomenclatures pour la rétrocompatibilité :
- ✅ Ancienne : `admin1_h_c`, `admin2_h_c`, `admin3_h_c`, `admin4_h_c`
- ✅ Nouvelle : `provinceId`, `antenneId`, `zoneId`, `aireId`

Mais pour les nouveaux formulaires, utilisez **obligatoirement** la nouvelle nomenclature.






