# Template XLSForm - Instructions d'Utilisation

Ce dossier contient les templates pour créer un XLSForm compatible avec le système de filtres géographiques du dashboard.

## Fichiers du Template

1. **xlsform_template_survey.csv** - Structure de la feuille "survey"
2. **xlsform_template_choices.csv** - Structure de la feuille "choices"
3. **xlsform_template_settings.csv** - Structure de la feuille "settings"
4. **xlsform_template_guide.md** - Guide détaillé de la nomenclature

## Comment Créer votre XLSForm

### Méthode 1 : Utiliser Excel

1. Ouvrez Excel
2. Créez un nouveau classeur
3. Importez les 3 fichiers CSV comme 3 feuilles séparées :
   - Feuille 1 : Renommez en "survey" et importez `xlsform_template_survey.csv`
   - Feuille 2 : Renommez en "choices" et importez `xlsform_template_choices.csv`
   - Feuille 3 : Renommez en "settings" et importez `xlsform_template_settings.csv`
4. Personnalisez les données selon vos besoins
5. Sauvegardez au format Excel (.xlsx)

### Méthode 2 : Utiliser Google Sheets

1. Créez un nouveau Google Sheet
2. Importez les 3 fichiers CSV comme 3 feuilles séparées
3. Renommez les feuilles en "survey", "choices", "settings"
4. Personnalisez les données
5. Téléchargez au format Excel (.xlsx)

## Points Critiques

### ⚠️ Nomenclature OBLIGATOIRE

Les colonnes géographiques **DOIVENT** s'appeler exactement :
- `provinceId` pour la Province
- `antenneId` pour l'Antenne
- `zoneId` pour la Zone de Santé
- `aireId` pour l'Aire de Santé

**Ne changez PAS ces noms de colonnes !**

### Structure des Filtres

Les filtres en cascade doivent être configurés ainsi :
- **Antenne** dépend de **Province** : `filter = ${provinceId}`
- **Zone de Santé** dépend de **Province** : `filter = ${provinceId}`
- **Aire de Santé** dépend de **Zone de Santé** : `filter = ${zoneId}`

### Exemple de Filtre dans la Feuille "choices"

Pour les zones qui dépendent de la province :
```
list_name: zones
name: zone_kinshasa_1
label: Zone de Santé Kinshasa 1
filter: ${provinceId}='kinshasa'
```

Pour les aires qui dépendent de la zone :
```
list_name: aires
name: aire_zone1_1
label: Aire de Santé Zone 1 - Aire 1
filter: ${zoneId}='zone_kinshasa_1'
```

## Personnalisation

Vous pouvez :
- ✅ Ajouter d'autres champs dans la feuille "survey"
- ✅ Modifier les labels (colonnes "label")
- ✅ Ajouter plus de provinces, zones, aires dans "choices"
- ✅ Modifier les catégories

Vous ne devez PAS :
- ❌ Renommer `provinceId`, `antenneId`, `zoneId`, `aireId`
- ❌ Supprimer ces colonnes
- ❌ Changer le type de ces champs (ils doivent rester `select_one`)

## Vérification

Après avoir créé votre XLSForm :

1. Importez-le dans le système via l'interface web
2. Vérifiez dans la base de données que les colonnes `provinceId`, `antenneId`, `zoneId`, `aireId` sont bien créées
3. Testez les filtres dans le dashboard - ils devraient maintenant fonctionner correctement

## Migration des Formulaires Existants

Si vous avez des formulaires qui utilisent les anciennes colonnes (`admin1_h_c`, etc.), vous pouvez utiliser le script de migration pour les renommer automatiquement.

## Support

Si vous avez des questions ou des problèmes, consultez le fichier `xlsform_template_guide.md` pour plus de détails.

