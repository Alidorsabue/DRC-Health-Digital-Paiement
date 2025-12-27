import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

interface XlsFormRow {
  type?: string;
  name?: string;
  label?: string;
  hint?: string;
  required?: string;
  constraint?: string;
  relevant?: string;
  calculation?: string;
  choice_filter?: string;
  appearance?: string;
  default?: string;
  [key: string]: any;
}

interface ChoiceRow {
  list_name?: string;
  name?: string;
  label?: string;
  [key: string]: any; // Pour les colonnes label::Language(code)
}

@Injectable()
export class XlsFormParserService {
  /**
   * Parse un fichier XlsForm et le convertit en schéma JSON
   */
  async parseXlsForm(fileBuffer: Buffer): Promise<{
    schema: any;
    formName: string;
    formDescription: string;
  }> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Lire la feuille "survey"
    const surveySheet = workbook.Sheets['survey'] || workbook.Sheets[workbook.SheetNames[0]];
    if (!surveySheet) {
      throw new Error('Feuille "survey" introuvable dans le fichier XlsForm');
    }

    const surveyRows: XlsFormRow[] = XLSX.utils.sheet_to_json(surveySheet);

    // Lire la feuille "choices" si elle existe
    const choicesSheet = workbook.Sheets['choices'];
    const choicesMap = new Map<string, Map<string, { label: string; labels?: Record<string, string>; filter?: string }>>();
    
    if (choicesSheet) {
      const choiceRows: any[] = XLSX.utils.sheet_to_json(choicesSheet);
      
      // Détecter les colonnes de labels multilingues dans choices
      const choiceLabelColumns = this.detectLabelColumns(choiceRows[0] || {});
      
      for (const choice of choiceRows) {
        if (choice.list_name && choice.name) {
          if (!choicesMap.has(choice.list_name)) {
            choicesMap.set(choice.list_name, new Map());
          }
          
          // Extraire le label principal et les labels multilingues
          const labelInfo = this.extractMultilingualLabel(choice, choiceLabelColumns);
          
          // Ajouter la propriété filter si elle existe
          const choiceInfo: { label: string; labels?: Record<string, string>; filter?: string } = {
            ...labelInfo,
          };
          if (choice.filter) {
            choiceInfo.filter = String(choice.filter).trim();
          }
          
          choicesMap.get(choice.list_name)!.set(choice.name, choiceInfo);
        }
      }
    }

    // Lire la feuille "settings" pour obtenir le nom et la description
    const settingsSheet = workbook.Sheets['settings'];
    let formName = 'Formulaire importé';
    let formDescription = '';

    if (settingsSheet) {
      const settingsRows: any[] = XLSX.utils.sheet_to_json(settingsSheet);
      if (settingsRows.length > 0) {
        formName = settingsRows[0].form_title || settingsRows[0].title || formName;
        formDescription = settingsRows[0].form_id || settingsRows[0].description || '';
      }
    }

    // Convertir les lignes en schéma JSON
    const schema = this.convertToJsonSchema(surveyRows, choicesMap);

    return {
      schema,
      formName,
      formDescription,
    };
  }

  /**
   * Détecte les colonnes de labels multilingues (format label::Language(code))
   */
  private detectLabelColumns(sampleRow: any): string[] {
    const labelColumns: string[] = [];
    if (!sampleRow) return labelColumns;
    
    for (const key of Object.keys(sampleRow)) {
      const lowerKey = key.toLowerCase();
      // Détecter les formats: label::French(fr), label::English(EN), label::fr, etc.
      if (lowerKey.startsWith('label::') || lowerKey.match(/^label::\s*\w+\s*\(?\w*\)?/i)) {
        labelColumns.push(key);
      }
    }
    return labelColumns;
  }

  /**
   * Extrait le label principal et les labels multilingues d'une ligne
   */
  private extractMultilingualLabel(row: any, labelColumns: string[]): {
    label: string;
    labels?: Record<string, string>;
  } {
    // Priorité: label::French(fr) > label::English(EN) > label > name
    let mainLabel = '';
    const labels: Record<string, string> = {};

    // Extraire tous les labels multilingues
    for (const col of labelColumns) {
      if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
        // Extraire la langue depuis le nom de colonne
        // Formats supportés: label::French(fr), label::English(EN), label::fr, etc.
        let langCode = '';
        let langName = '';
        
        const match1 = col.match(/label::\s*(\w+)\s*\((\w+)\)/i); // label::French(fr)
        const match2 = col.match(/label::\s*(\w+)/i); // label::fr ou label::French
        
        if (match1) {
          langCode = match1[2].toLowerCase();
          langName = match1[1];
        } else if (match2) {
          const extracted = match2[1].toLowerCase();
          // Si c'est un code de langue (2-3 lettres), l'utiliser comme code
          if (extracted.length <= 3) {
            langCode = extracted;
          } else {
            // Sinon, c'est probablement un nom de langue
            langName = extracted;
            // Essayer de deviner le code
            if (extracted.includes('french') || extracted.includes('francais')) {
              langCode = 'fr';
            } else if (extracted.includes('english') || extracted.includes('anglais')) {
              langCode = 'en';
            } else {
              langCode = extracted.substring(0, 2);
            }
          }
        }
        
        if (langCode) {
          labels[langCode] = String(row[col]).trim();
          
          // Priorité au français
          if (langCode === 'fr' || langName.toLowerCase().includes('french') || langName.toLowerCase().includes('francais')) {
            if (!mainLabel) {
              mainLabel = String(row[col]).trim();
            }
          }
        }
      }
    }

    // Si pas de label français, prendre l'anglais
    if (!mainLabel) {
      for (const [code, label] of Object.entries(labels)) {
        if (code === 'en' || code === 'english') {
          mainLabel = label;
          break;
        }
      }
    }

    // Si toujours pas de label, prendre le premier disponible
    if (!mainLabel) {
      const firstLabel = Object.values(labels)[0];
      if (firstLabel) {
        mainLabel = firstLabel;
      } else if (row.label) {
        mainLabel = String(row.label).trim();
      } else if (row.name) {
        mainLabel = String(row.name).trim();
      }
    }

    return {
      label: mainLabel,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    };
  }

  /**
   * Extrait le hint multilingue d'une ligne
   */
  private extractMultilingualHint(row: any): {
    hint: string;
    hints?: Record<string, string>;
  } {
    const hintColumns: string[] = [];
    if (row) {
      for (const key of Object.keys(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.startsWith('hint::') || lowerKey.match(/^hint::\s*\w+/i)) {
          hintColumns.push(key);
        }
      }
    }

    let mainHint = '';
    const hints: Record<string, string> = {};

    for (const col of hintColumns) {
      if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
        let langCode = '';
        const match1 = col.match(/hint::\s*(\w+)\s*\((\w+)\)/i);
        const match2 = col.match(/hint::\s*(\w+)/i);
        
        if (match1) {
          langCode = match1[2].toLowerCase();
        } else if (match2) {
          const extracted = match2[1].toLowerCase();
          if (extracted.length <= 3) {
            langCode = extracted;
          } else {
            if (extracted.includes('french') || extracted.includes('francais')) {
              langCode = 'fr';
            } else if (extracted.includes('english')) {
              langCode = 'en';
            } else {
              langCode = extracted.substring(0, 2);
            }
          }
        }
        
        if (langCode) {
          hints[langCode] = String(row[col]).trim();
          if (langCode === 'fr' && !mainHint) {
            mainHint = String(row[col]).trim();
          }
        }
      }
    }

    if (!mainHint) {
      if (hints['en']) {
        mainHint = hints['en'];
      } else {
        const firstHint = Object.values(hints)[0];
        if (firstHint) {
          mainHint = firstHint;
        } else if (row.hint) {
          mainHint = String(row.hint).trim();
        }
      }
    }

    return {
      hint: mainHint,
      hints: Object.keys(hints).length > 0 ? hints : undefined,
    };
  }

  /**
   * Convertit les lignes XlsForm en schéma JSON Schema
   */
  private convertToJsonSchema(
    rows: XlsFormRow[],
    choicesMap: Map<string, Map<string, { label: string; labels?: Record<string, string>; filter?: string }>>,
  ): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    let order = 0;

    // Détecter les colonnes de labels multilingues dans survey
    const labelColumns = rows.length > 0 ? this.detectLabelColumns(rows[0]) : [];

    // Gérer les groupes et répétitions
    let currentGroup: string | null = null;
    let currentRepeat: string | null = null;
    const groupStack: Array<{ name: string; label: string; order: number; appearance?: string }> = [];
    const repeatStack: Array<{ name: string; label: string; order: number }> = [];

    for (const row of rows) {
      if (!row.type || !row.name) {
        continue; // Ignorer les lignes sans type ou nom
      }

      const fieldName = row.name.trim();
      const rowTypeLower = row.type.toLowerCase().trim();

      // Gérer begin_group
      if (rowTypeLower === 'begin_group' || rowTypeLower.startsWith('begin_group')) {
        const labelInfo = this.extractMultilingualLabel(row, labelColumns);
        const groupName = fieldName;
        currentGroup = groupName;
        
        // Stocker l'appearance du groupe si présente
        const groupAppearance = row.appearance || '';
        
        groupStack.push({
          name: groupName,
          label: labelInfo.label || groupName,
          order: order++,
          appearance: groupAppearance,
        });
        continue;
      }

      // Gérer end_group
      if (rowTypeLower === 'end_group' || rowTypeLower.startsWith('end_group')) {
        if (groupStack.length > 0) {
          groupStack.pop();
          currentGroup = groupStack.length > 0 ? groupStack[groupStack.length - 1].name : null;
        }
        continue;
      }

      // Gérer begin_repeat
      if (rowTypeLower === 'begin_repeat' || rowTypeLower.startsWith('begin_repeat')) {
        const labelInfo = this.extractMultilingualLabel(row, labelColumns);
        const repeatName = fieldName;
        currentRepeat = repeatName;
        repeatStack.push({
          name: repeatName,
          label: labelInfo.label || repeatName,
          order: order++,
        });
        continue;
      }

      // Gérer end_repeat
      if (rowTypeLower === 'end_repeat' || rowTypeLower.startsWith('end_repeat')) {
        if (repeatStack.length > 0) {
          repeatStack.pop();
          currentRepeat = repeatStack.length > 0 ? repeatStack[repeatStack.length - 1].name : null;
        }
        continue;
      }

      // Gérer les champs métadonnées (start, end, audit, deviceid) - champs cachés
      const metadataFields = ['start', 'end', 'audit', 'deviceid', 'simserial', 'phonenumber', 'subscriberid', 'username'];
      if (metadataFields.includes(rowTypeLower) || metadataFields.includes(fieldName.toLowerCase())) {
        // Créer un champ caché pour les métadonnées
        const fieldSchema: any = {
          type: 'string',
          title: fieldName,
          'x-type': 'hidden',
          'x-order': order++,
          'x-metadata': true,
        };
        
        if (rowTypeLower === 'start' || rowTypeLower === 'end') {
          fieldSchema.format = 'date-time';
        }
        
        if (rowTypeLower === 'audit' && row.parameters) {
          fieldSchema['x-auditParams'] = row.parameters;
        }
        
        properties[fieldName] = fieldSchema;
        continue;
      }

      const fieldType = this.mapXlsFormTypeToJsonType(row.type);
      
      if (!fieldType) {
        continue; // Ignorer les types non supportés
      }

      // Extraire le label multilingue
      const labelInfo = this.extractMultilingualLabel(row, labelColumns);
      
      // Extraire le hint multilingue
      const hintInfo = this.extractMultilingualHint(row);

      const fieldSchema: any = {
        type: fieldType.jsonType,
        title: labelInfo.label || fieldName, // Le label peut contenir du markdown/HTML
        description: hintInfo.hint || '', // Le hint peut contenir du markdown/HTML
        'x-order': order++,
      };
      
      // Pour les champs note, le texte est dans le label (title)
      // Pour les autres champs, le hint est dans description et peut être stocké dans x-noteText
      if (hintInfo.hint) {
        fieldSchema['x-noteText'] = hintInfo.hint; // Préserver le formatage markdown/HTML
      }

      // Ajouter les labels multilingues si disponibles
      if (labelInfo.labels) {
        fieldSchema['x-labels'] = labelInfo.labels;
      }

      // Ajouter les hints multilingues si disponibles
      if (hintInfo.hints) {
        fieldSchema['x-hints'] = hintInfo.hints;
      }

      // Gérer les groupes
      if (currentGroup) {
        fieldSchema['x-group'] = currentGroup;
        // Stocker l'appearance du groupe si présente
        const currentGroupInfo = groupStack.find(g => g.name === currentGroup);
        if (currentGroupInfo?.appearance) {
          fieldSchema['x-groupAppearance'] = currentGroupInfo.appearance;
        }
      }

      // Gérer les répétitions
      if (currentRepeat) {
        fieldSchema['x-repeat'] = currentRepeat;
      }

      // Gérer les types spéciaux - SELECT ONE et SELECT MULTIPLE
      if (fieldType.isSelect) {
        const listName = this.extractListName(row.type);
        const isMultiple = row.type.toLowerCase().includes('select_multiple');
        
        if (listName && choicesMap.has(listName)) {
          const choices = choicesMap.get(listName)!;
          const enumValues: string[] = [];
          const options: Array<{ label: string; value: string; labels?: Record<string, string> }> = [];

          choices.forEach((choiceInfo, value) => {
            enumValues.push(value);
            const option: any = {
              label: choiceInfo.label,
              value: value,
            };
            if (choiceInfo.labels) {
              option.labels = choiceInfo.labels;
            }
            // Ajouter la propriété filter si elle existe
            if (choiceInfo.filter) {
              option.filter = choiceInfo.filter;
            }
            options.push(option);
          });

          // Définir x-type pour identifier correctement le type de champ
          if (isMultiple) {
            fieldSchema['x-type'] = 'select_multiple';
            fieldSchema.type = 'array';
            fieldSchema.items = {
              type: 'string',
              enum: enumValues,
            };
            // Stocker les options dans x-options pour le builder
            fieldSchema['x-options'] = options;
            fieldSchema.items['x-options'] = options;
          } else {
            fieldSchema['x-type'] = 'select_one';
            fieldSchema.type = 'string';
            fieldSchema.enum = enumValues;
            // Stocker les options dans x-options pour le builder
            fieldSchema['x-options'] = options;
            // Garder x-enumNames pour compatibilité
            fieldSchema['x-enumNames'] = options.map(opt => opt.label);
          }
        } else {
          // Si la liste n'existe pas, créer quand même le champ mais sans options
          console.warn(`Liste "${listName}" non trouvée pour le champ ${fieldName}`);
          if (isMultiple) {
            fieldSchema['x-type'] = 'select_multiple';
            fieldSchema.type = 'array';
            fieldSchema.items = { type: 'string', enum: [] };
            fieldSchema['x-options'] = [];
          } else {
            fieldSchema['x-type'] = 'select_one';
            fieldSchema.type = 'string';
            fieldSchema.enum = [];
            fieldSchema['x-options'] = [];
          }
        }
      }

      // Gérer les champs requis
      if (row.required === 'yes' || row.required === 'true' || row.required === '1') {
        required.push(fieldName);
        fieldSchema['x-required'] = true;
      }

      // Gérer les contraintes
      if (row.constraint) {
        fieldSchema['x-constraint'] = row.constraint;
        // Essayer de convertir en pattern si possible
        const pattern = this.convertConstraintToPattern(row.constraint);
        if (pattern) {
          fieldSchema.pattern = pattern;
        }
        // Extraire minLength et maxLength des contraintes
        const lengthConstraints = this.extractLengthConstraints(row.constraint);
        if (lengthConstraints.minLength !== undefined) {
          fieldSchema.minLength = lengthConstraints.minLength;
          fieldSchema['x-minLength'] = lengthConstraints.minLength;
        }
        if (lengthConstraints.maxLength !== undefined) {
          fieldSchema.maxLength = lengthConstraints.maxLength;
          fieldSchema['x-maxLength'] = lengthConstraints.maxLength;
        }
      }

      // Gérer les messages de contrainte
      if (row['constraint_message']) {
        fieldSchema['x-constraintMessage'] = row['constraint_message'];
      }

      // Gérer les dépendances (relevant)
      if (row.relevant) {
        // Stocker l'expression relevant complète
        fieldSchema['x-relevant'] = row.relevant;
        
        // Parser aussi pour extraire les informations simples (pour compatibilité)
        const dependencyInfo = this.parseRelevantExpression(row.relevant);
        if (dependencyInfo.field) {
          fieldSchema['x-dependsOn'] = dependencyInfo.field;
          if (dependencyInfo.value !== null) {
            fieldSchema['x-dependsValue'] = dependencyInfo.value;
          }
          if (dependencyInfo.operator) {
            fieldSchema['x-dependsOperator'] = dependencyInfo.operator;
          }
        }
      }

      // Gérer les calculs - ne pas afficher comme une question mais comme un affichage
      if (row.calculation) {
        fieldSchema['x-calculate'] = row.calculation;
        fieldSchema.readOnly = true;
        fieldSchema['x-type'] = 'calculate';
        fieldSchema['x-displayOnly'] = true; // Ne pas afficher comme une question
        // Le champ calculate affiche seulement le résultat du calcul
      }

      // Gérer les valeurs par défaut
      if (row.default !== undefined && row.default !== null && row.default !== '') {
        fieldSchema.default = this.parseDefaultValue(row.default, fieldSchema.type || fieldType.jsonType);
      }

      // Gérer l'apparence (appearance) - très important pour XlsForm
      if (row.appearance) {
        const appearance = row.appearance.toLowerCase();
        
        // Stocker l'appearance complète pour référence
        fieldSchema['x-appearance'] = row.appearance;
        
        // Pour les champs texte
        if (appearance.includes('multiline')) {
          fieldSchema['x-multiline'] = true;
        }
        if (appearance.includes('numbers') || appearance.includes('number')) {
          fieldSchema['x-numeric'] = true;
          fieldSchema['x-appearance'] = 'number';
        }
        
        // Pour les select - différentes présentations
        if (fieldType.isSelect) {
          if (appearance.includes('minimal') || appearance.includes('compact')) {
            fieldSchema['x-appearance'] = 'minimal';
          } else if (appearance.includes('quick')) {
            fieldSchema['x-appearance'] = 'quick';
          } else if (appearance.includes('horizontal') || appearance.includes('horizontal-compact')) {
            fieldSchema['x-appearance'] = 'horizontal';
          } else if (appearance.includes('label')) {
            fieldSchema['x-appearance'] = 'label';
          } else if (appearance.includes('list-nolabel')) {
            fieldSchema['x-appearance'] = 'list-nolabel';
          } else if (appearance.includes('likert')) {
            fieldSchema['x-appearance'] = 'likert';
          }
        }
        
        // Pour les dates
        if (appearance.includes('no-calendar')) {
          fieldSchema['x-noCalendar'] = true;
        }
        if (appearance.includes('month-year')) {
          fieldSchema['x-dateFormat'] = 'month-year';
        }
        if (appearance.includes('year')) {
          fieldSchema['x-dateFormat'] = 'year';
        }
      }

      // Gérer choice_filter (filtrage dynamique des choix)
      if (row.choice_filter) {
        // Parser le choice_filter pour extraire les informations
        const filterInfo = this.parseChoiceFilter(row.choice_filter);
        fieldSchema['x-choiceFilter'] = row.choice_filter;
        if (filterInfo.filterField) {
          fieldSchema['x-filterField'] = filterInfo.filterField;
        }
        if (filterInfo.filterValue) {
          fieldSchema['x-filterValue'] = filterInfo.filterValue;
        }
        if (filterInfo.filterOperator) {
          fieldSchema['x-filterOperator'] = filterInfo.filterOperator;
        }
      }

      // Gérer repeat_count (pour les répétitions)
      if (row.repeat_count) {
        fieldSchema['x-repeatCount'] = row.repeat_count;
      }

      // Gérer readonly (champs en lecture seule)
      if (row.read_only === 'yes' || row.read_only === 'true' || row.read_only === '1') {
        fieldSchema.readOnly = true;
      }

      // Mapper les types spécifiques - définir x-type pour tous (sauf si déjà défini pour select)
      const lowerType = row.type.toLowerCase();
      
      // Ne pas écraser x-type si c'est déjà un select
      if (!fieldSchema['x-type']) {
        if (lowerType.includes('geopoint') || lowerType.includes('geoshape') || lowerType.includes('geotrace')) {
          fieldSchema['x-type'] = 'geopoint';
          fieldSchema.type = 'object';
          fieldSchema.properties = {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            altitude: { type: 'number' },
            accuracy: { type: 'number' },
          };
        } else if (lowerType.includes('date')) {
          fieldSchema['x-type'] = 'date';
          fieldSchema.format = 'date';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('time')) {
          fieldSchema['x-type'] = 'time';
          fieldSchema.format = 'time';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('datetime')) {
          fieldSchema['x-type'] = 'datetime';
          fieldSchema.format = 'date-time';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('image') || lowerType.includes('photo')) {
          // Vérifier si appearance="signature" pour convertir en type draw
          const appearance = row.appearance ? row.appearance.toLowerCase() : '';
          if (appearance.includes('signature')) {
            fieldSchema['x-type'] = 'draw';
            fieldSchema['x-appearance'] = 'signature';
          } else {
            fieldSchema['x-type'] = 'image';
          }
          fieldSchema.type = 'string';
          fieldSchema.format = 'data-url';
        } else if (lowerType.includes('video')) {
          fieldSchema['x-type'] = 'video';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('audio')) {
          fieldSchema['x-type'] = 'audio';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('file')) {
          fieldSchema['x-type'] = 'file';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('barcode') || lowerType.includes('qr')) {
          fieldSchema['x-type'] = 'barcode';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('draw') || lowerType.includes('signature')) {
          fieldSchema['x-type'] = 'draw';
          fieldSchema.type = 'string';
          fieldSchema.format = 'data-url';
        } else if (lowerType.includes('integer')) {
          fieldSchema['x-type'] = 'integer';
          fieldSchema.type = 'number';
        } else if (lowerType.includes('decimal')) {
          fieldSchema['x-type'] = 'decimal';
          fieldSchema.type = 'number';
        } else if (lowerType.includes('text')) {
          fieldSchema['x-type'] = 'text';
          fieldSchema.type = 'string';
        } else if (lowerType.includes('note')) {
          fieldSchema['x-type'] = 'note';
          fieldSchema.type = 'string';
          fieldSchema.readOnly = true;
        } else if (lowerType.includes('calculate')) {
          fieldSchema['x-type'] = 'calculate';
          fieldSchema.readOnly = true;
        } else if (lowerType.includes('boolean') || lowerType.includes('yes_no')) {
          fieldSchema['x-type'] = 'boolean';
          fieldSchema.type = 'boolean';
        }
      }

      properties[fieldName] = fieldSchema;
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Mappe un type XlsForm vers un type JSON Schema
   */
  private mapXlsFormTypeToJsonType(
    xlsType: string,
  ): { jsonType: string; isSelect: boolean } | null {
    const lowerType = xlsType.toLowerCase().trim();

    if (lowerType.startsWith('select_one') || lowerType.startsWith('select_multiple')) {
      return { jsonType: 'string', isSelect: true };
    }

    if (lowerType.includes('text')) {
      return { jsonType: 'string', isSelect: false };
    }

    if (lowerType.includes('integer') || lowerType.includes('decimal') || lowerType.includes('calculate')) {
      return { jsonType: 'number', isSelect: false };
    }

    if (lowerType.includes('date') || lowerType.includes('time')) {
      return { jsonType: 'string', isSelect: false };
    }

    if (lowerType.includes('boolean') || lowerType.includes('yes_no')) {
      return { jsonType: 'boolean', isSelect: false };
    }

    // Note: les groupes et répétitions sont gérés avant l'appel à cette fonction
    if (lowerType.includes('note')) {
      return { jsonType: 'string', isSelect: false }; // Note est un type valide
    }

    return { jsonType: 'string', isSelect: false };
  }

  /**
   * Extrait le nom de la liste depuis un type select
   */
  private extractListName(type: string): string | null {
    const match = type.match(/select_(one|multiple)\s+(\w+)/i);
    return match ? match[2] : null;
  }

  /**
   * Convertit une contrainte XlsForm en pattern regex
   */
  private convertConstraintToPattern(constraint: string): string | undefined {
    // Les contraintes XlsForm peuvent être complexes, on les garde telles quelles pour l'instant
    // et on les évaluera côté client
    return undefined;
  }

  /**
   * Extrait les contraintes de longueur (minLength, maxLength) d'une contrainte XlsForm
   */
  private extractLengthConstraints(constraint: string): {
    minLength?: number;
    maxLength?: number;
  } {
    const result: { minLength?: number; maxLength?: number } = {};
    
    // Détecter les patterns de longueur courants
    // Exemples: string-length(.) <= 10, string-length(.) >= 5, string-length(.) = 10
    // Ou: .length <= 10, .length >= 5, .length = 10
    
    // Pattern pour string-length(.) <= X ou string-length(.) >= X ou string-length(.) = X
    const stringLengthPattern = /string-length\(\.\)\s*(<=|>=|=)\s*(\d+)/i;
    const stringLengthMatch = constraint.match(stringLengthPattern);
    if (stringLengthMatch) {
      const operator = stringLengthMatch[1];
      const length = parseInt(stringLengthMatch[2], 10);
      if (operator === '<=' || operator === '=') {
        result.maxLength = length;
      }
      if (operator === '>=' || operator === '=') {
        result.minLength = length;
      }
    }
    
    // Pattern pour .length <= X ou .length >= X ou .length = X
    const lengthPattern = /\.length\s*(<=|>=|=)\s*(\d+)/i;
    const lengthMatch = constraint.match(lengthPattern);
    if (lengthMatch) {
      const operator = lengthMatch[1];
      const length = parseInt(lengthMatch[2], 10);
      if (operator === '<=' || operator === '=') {
        result.maxLength = length;
      }
      if (operator === '>=' || operator === '=') {
        result.minLength = length;
      }
    }
    
    // Pattern pour regex avec quantifiers: .{5,10} ou .{10} ou .{5,}
    const regexQuantifierPattern = /\.\{(\d+)(?:,(\d+))?\}/;
    const regexMatch = constraint.match(regexQuantifierPattern);
    if (regexMatch) {
      const min = parseInt(regexMatch[1], 10);
      const max = regexMatch[2] ? parseInt(regexMatch[2], 10) : undefined;
      result.minLength = min;
      if (max !== undefined) {
        result.maxLength = max;
      }
    }
    
    return result;
  }

  /**
   * Parse une expression relevant pour extraire les informations de dépendance
   */
  private parseRelevantExpression(relevant: string): {
    field: string | null;
    value: string | null;
    operator: string | null;
  } {
    // Exemples de formats:
    // ${field_name} = 'value'
    // ${field_name} != 'value'
    // ${field_name} = ''
    // ${field_name} > 5
    // ${field_name} < 10
    // ${field_name} >= 5
    // ${field_name} <= 10
    
    const fieldMatch = relevant.match(/\$\{([^}]+)\}/);
    if (!fieldMatch) {
      return { field: null, value: null, operator: null };
    }

    const field = fieldMatch[1];
    let operator: string | null = null;
    let value: string | null = null;

    // Chercher les opérateurs
    if (relevant.includes('!=')) {
      operator = '!=';
      const valueMatch = relevant.match(/!=\s*(['"]?)([^'"]+)\1/);
      value = valueMatch ? valueMatch[2] : null;
    } else if (relevant.includes('>=')) {
      operator = '>=';
      const valueMatch = relevant.match(/>=\s*(['"]?)([^'"]+)\1/);
      value = valueMatch ? valueMatch[2] : null;
    } else if (relevant.includes('<=')) {
      operator = '<=';
      const valueMatch = relevant.match(/<=\s*(['"]?)([^'"]+)\1/);
      value = valueMatch ? valueMatch[2] : null;
    } else if (relevant.includes('>')) {
      operator = '>';
      const valueMatch = relevant.match(/>\s*(['"]?)([^'"]+)\1/);
      value = valueMatch ? valueMatch[2] : null;
    } else if (relevant.includes('<')) {
      operator = '<';
      const valueMatch = relevant.match(/<\s*(['"]?)([^'"]+)\1/);
      value = valueMatch ? valueMatch[2] : null;
    } else if (relevant.includes('=')) {
      operator = '=';
      const valueMatch = relevant.match(/=\s*(['"]?)([^'"]*)\1/);
      value = valueMatch ? valueMatch[2] : null;
    }

    return { field, value, operator };
  }

  /**
   * Parse une valeur par défaut selon le type
   */
  private parseDefaultValue(defaultValue: string, jsonType: string): any {
    if (jsonType === 'number') {
      return parseFloat(defaultValue);
    }
    if (jsonType === 'boolean') {
      return defaultValue.toLowerCase() === 'true' || defaultValue === '1' || defaultValue === 'yes';
    }
    return defaultValue;
  }

  /**
   * Parse un choice_filter pour extraire les informations de filtrage
   */
  private parseChoiceFilter(choiceFilter: string): {
    filterField: string | null;
    filterValue: string | null;
    filterOperator: string | null;
  } {
    // Formats possibles:
    // ${field_name} = 'value'
    // ${field_name} != 'value'
    // ${field_name} = ${other_field}
    
    const fieldMatch = choiceFilter.match(/\$\{([^}]+)\}/);
    if (!fieldMatch) {
      return { filterField: null, filterValue: null, filterOperator: null };
    }

    const filterField = fieldMatch[1];
    let filterValue: string | null = null;
    let filterOperator: string | null = null;

    // Chercher les opérateurs
    if (choiceFilter.includes('!=')) {
      filterOperator = '!=';
      const valueMatch = choiceFilter.match(/!=\s*(['"]?)([^'"]+)\1/);
      if (valueMatch) {
        filterValue = valueMatch[2];
      } else {
        // Peut-être une référence à un autre champ
        const refMatch = choiceFilter.match(/!=\s*\$\{([^}]+)\}/);
        if (refMatch) {
          filterValue = `$${refMatch[1]}`;
        }
      }
    } else if (choiceFilter.includes('=')) {
      filterOperator = '=';
      const valueMatch = choiceFilter.match(/=\s*(['"]?)([^'"]*)\1/);
      if (valueMatch) {
        filterValue = valueMatch[2];
      } else {
        // Peut-être une référence à un autre champ
        const refMatch = choiceFilter.match(/=\s*\$\{([^}]+)\}/);
        if (refMatch) {
          filterValue = `$${refMatch[1]}`;
        }
      }
    }

    return { filterField, filterValue, filterOperator };
  }
}

