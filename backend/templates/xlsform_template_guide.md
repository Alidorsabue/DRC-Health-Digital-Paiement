# Guide du Template XLSForm pour la Nomenclature Standardisée

Ce document décrit la structure du template XLSForm à utiliser pour garantir la compatibilité avec le système de filtres géographiques du dashboard.

## Nomenclature des Colonnes Géographiques

Pour que les filtres (Province, Zone de Santé, Aire de Santé) fonctionnent correctement dans le dashboard, vous **DEVEZ** utiliser les noms de colonnes suivants dans votre XLSForm :

### Colonnes Géographiques Obligatoires

| Nom de la Colonne | Description | Type |
|-------------------|-------------|------|
| `provinceId` | **Province** | select_one |
| `antenneId` | **Antenne** | select_one |
| `zoneId` | **Zone de Santé** | select_one |
| `aireId` | **Aire de Santé** | select_one |

**Note :** Le système supporte également les anciennes nomenclatures (`admin1_h_c`, `admin2_h_c`, `admin3_h_c`, `admin4_h_c` et `province_id`, `zone_id`, etc.) pour la rétrocompatibilité, mais la nomenclature standard est `provinceId`, `antenneId`, `zoneId`, `aireId`.

## Structure du Fichier XLSForm

Votre fichier XLSForm doit contenir au minimum 3 feuilles :
1. **survey** - Définit les champs du formulaire
2. **choices** - Définit les options pour les champs select
3. **settings** - Définit les métadonnées du formulaire

### Feuille "survey"

Cette feuille doit contenir les colonnes suivantes :

| type | name | label | required | appearance | choice_filter |
|------|------|-------|----------|------------|---------------|
| select_one provinces | **provinceId** | Province | yes | | |
| select_one antennes | **antenneId** | Antenne | no | | ${provinceId} |
| select_one zones | **zoneId** | Zone de Santé | yes | | ${provinceId} |
| select_one aires | **aireId** | Aire de Santé | yes | | ${zoneId} |
| text | family_name_i_c | Nom de famille | yes | | |
| text | given_name_i_c | Prénom | yes | | |
| text | telephone | Téléphone | yes | | |
| select_one categories | categorie | Catégorie | yes | | |

**IMPORTANT :** 
- Les noms de colonnes géographiques (`provinceId`, `antenneId`, `zoneId`, `aireId`) sont **OBLIGATOIRES** et doivent être exactement comme indiqué.
- Les autres champs peuvent être personnalisés selon vos besoins.

### Feuille "choices"

Cette feuille doit contenir les listes de choix pour les champs géographiques :

#### Liste "provinces"
| list_name | name | label |
|-----------|------|-------|
| provinces | kinshasa | Kinshasa |
| provinces | kwilu | Kwilu |
| provinces | ... | ... |

#### Liste "antennes"
| list_name | name | label | filter |
|-----------|------|-------|--------|
| antennes | antenne1 | Antenne 1 | ${provinceId}='kinshasa' |
| antennes | antenne2 | Antenne 2 | ${provinceId}='kinshasa' |

#### Liste "zones"
| list_name | name | label | filter |
|-----------|------|-------|--------|
| zones | zone1 | Zone de Santé 1 | ${provinceId}='kinshasa' |
| zones | zone2 | Zone de Santé 2 | ${provinceId}='kinshasa' |

#### Liste "aires"
| list_name | name | label | filter |
|-----------|------|-------|--------|
| aires | aire1 | Aire de Santé 1 | ${zoneId}='zone1' |
| aires | aire2 | Aire de Santé 2 | ${zoneId}='zone1' |

### Feuille "settings"

| form_title | form_id | version | default_language |
|------------|---------|---------|------------------|
| Nom de votre formulaire | formulaire_enregistrement | 1 | French |

## Exemple Complet de la Feuille "survey"

```
type,name,label,required,appearance,choice_filter,calculation,constraint,constraint_message
start,start,Date de début,,
end,end,Date de fin,,
select_one provinces,provinceId,Province,yes,,
select_one antennes,antenneId,Antenne,no,,${provinceId}
select_one zones,zoneId,Zone de Santé,yes,,${provinceId}
select_one aires,aireId,Aire de Santé,yes,,${zoneId}
text,family_name_i_c,Nom de famille,yes,,
text,given_name_i_c,Prénom,yes,,
text,postnom,Postnom,no,,
text,telephone,Téléphone,yes,,
select_one categories,categorie,Catégorie,yes,,
note,note,Autres informations,,
```

## Exemple Complet de la Feuille "choices"

```
list_name,name,label,filter
provinces,kinshasa,Kinshasa,
provinces,kwilu,Kwilu,
provinces,kongo_central,Kongo Central,
antennes,antenne_kinshasa_1,Antenne Kinshasa 1,${provinceId}='kinshasa'
antennes,antenne_kinshasa_2,Antenne Kinshasa 2,${provinceId}='kinshasa'
zones,zone_kinshasa_1,Zone de Santé Kinshasa 1,${provinceId}='kinshasa'
zones,zone_kinshasa_2,Zone de Santé Kinshasa 2,${provinceId}='kinshasa'
aires,aire_zone1_1,Aire de Santé Zone 1 - Aire 1,${zoneId}='zone_kinshasa_1'
aires,aire_zone1_2,Aire de Santé Zone 1 - Aire 2,${zoneId}='zone_kinshasa_1'
categories,medecin,Médecin,
categories,infirmier,Infirmier,
categories,autre,Autre,
```

## Notes Importantes

1. **Nomenclature stricte** : Les noms de colonnes `provinceId`, `antenneId`, `zoneId`, `aireId` sont **obligatoires** et doivent être exactement comme indiqué (sensible à la casse).

2. **Filtres en cascade** : 
   - Les antennes dépendent de la province (`${provinceId}`)
   - Les zones dépendent de la province (`${provinceId}`)
   - Les aires dépendent de la zone (`${zoneId}`)

3. **Valeurs des choix** : Les valeurs dans la colonne `name` de la feuille `choices` doivent correspondre aux IDs utilisés dans votre base de données géographique.

4. **Compatibilité** : Ce template garantit que les filtres du dashboard fonctionneront correctement avec votre formulaire.

## Vérification

Après avoir créé votre XLSForm :
1. Importez-le dans le système
2. Vérifiez que les colonnes `provinceId`, `antenneId`, `zoneId`, `aireId` sont bien créées dans la table
3. Testez les filtres dans le dashboard

## Support des Anciens Formulaires

Le système supporte également les anciennes nomenclatures pour la rétrocompatibilité :
- `admin1_h_c`, `admin2_h_c`, `admin3_h_c`, `admin4_h_c` → mappent automatiquement vers `provinceId`, `antenneId`, `zoneId`, `aireId`
- `province_id` / `provinceId` → mappe vers `provinceId`
- `zone_id` / `zoneId` → mappe vers `zoneId`
- `aire_id` / `aireId` → mappe vers `aireId`

Mais pour les nouveaux formulaires, utilisez **obligatoirement** `provinceId`, `antenneId`, `zoneId`, `aireId`.

## Migration des Formulaires Existants

Si vous avez des formulaires existants qui utilisent `admin1_h_c`, `admin2_h_c`, `admin3_h_c`, `admin4_h_c`, vous pouvez :
1. Utiliser le script de migration pour renommer les colonnes (voir `scripts/migrate-form-columns.js`)
2. Ou simplement republier le formulaire avec la nouvelle nomenclature - le système supporte les deux formats

