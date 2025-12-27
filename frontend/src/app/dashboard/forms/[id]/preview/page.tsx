'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../../../store/authStore';
import { formsApi } from '../../../../../lib/api/forms';
import { Form } from '../../../../../types';
import Link from 'next/link';

// Composant pour rendre le texte formaté (markdown/HTML) - même que dans builder
function FormattedText({ 
  text, 
  className = '', 
  fields = [],
  formData = {}
}: { 
  text: string; 
  className?: string; 
  fields?: FormField[];
  formData?: Record<string, any>;
}) {
  if (!text) return null;

  // Fonction pour évaluer les références ${fieldName} ou {fieldName}
  const evaluateText = (input: string): string => {
    let result = input;
    // Pattern pour ${fieldName} ou {fieldName}
    const fieldPattern = /\$\{([^}]+)\}|(?<!\$)\{([^}]+)\}/g;
    let match;
    
    while ((match = fieldPattern.exec(input)) !== null) {
      const fieldName = (match[1] || match[2])?.trim() || '';
      if (!fieldName) continue;
      
      // Chercher la valeur dans formData d'abord
      if (formData[fieldName] !== undefined && formData[fieldName] !== null && formData[fieldName] !== '') {
        result = result.replace(match[0], String(formData[fieldName]));
      } else {
        // Si pas de valeur, chercher le label du champ référencé
        const referencedField = fields.find(f => f.name === fieldName);
        if (referencedField) {
          result = result.replace(match[0], referencedField.label || fieldName);
        } else {
          result = result.replace(match[0], fieldName);
        }
      }
    }
    
    return result;
  };

  // Fonction pour convertir markdown et HTML en JSX
  const parseFormattedText = (input: string): React.ReactNode[] => {
    // Évaluer d'abord les références ${fieldName}
    const evaluatedInput = evaluateText(input);
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let key = 0;

    // Parser les balises HTML avec style
    const htmlPattern = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
    let match;
    const matches: Array<{ start: number; end: number; tag: string; attrs: string; content: string }> = [];

    while ((match = htmlPattern.exec(input)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        tag: match[1],
        attrs: match[2],
        content: match[3],
      });
    }

    // Trier les matches par position
    matches.sort((a, b) => a.start - b.start);

    // Traiter le texte
    for (const htmlMatch of matches) {
      // Ajouter le texte avant la balise
      if (htmlMatch.start > currentIndex) {
        const beforeText = input.substring(currentIndex, htmlMatch.start);
        if (beforeText) {
          parts.push(...parseMarkdown(beforeText, key++));
        }
      }

      // Parser les attributs de style
      const styleMatch = htmlMatch.attrs.match(/style\s*=\s*["']([^"']+)["']/);
      const style: React.CSSProperties = {};
      if (styleMatch) {
        const styleContent = styleMatch[1];
        const colorMatch = styleContent.match(/color\s*:\s*([^;]+)/);
        if (colorMatch) {
          const color = colorMatch[1].trim();
          style.color = color === 'black' ? '#000000' : color;
        }
        const fontWeightMatch = styleContent.match(/font-weight\s*:\s*([^;]+)/);
        if (fontWeightMatch && (fontWeightMatch[1].trim() === 'bold' || fontWeightMatch[1].trim() === '700')) {
          style.fontWeight = 'bold';
        }
      }

      // Appliquer les styles selon le tag
      const tagName = htmlMatch.tag.toLowerCase();
      if (tagName === 'strong' || tagName === 'b') {
        style.fontWeight = 'bold';
      } else if (tagName === 'em' || tagName === 'i') {
        style.fontStyle = 'italic';
      } else if (tagName === 'u') {
        style.textDecoration = 'underline';
      } else if (tagName.startsWith('h')) {
        const level = parseInt(tagName.substring(1)) || 1;
        style.fontSize = `${20 - level * 2}px`;
        style.fontWeight = 'bold';
      }

      // Récursivement parser le contenu
      const content = parseFormattedText(htmlMatch.content);
      parts.push(
        <span key={key++} style={style}>
          {content}
        </span>
      );

      currentIndex = htmlMatch.end;
    }

    // Ajouter le texte restant
    if (currentIndex < input.length) {
      const remaining = input.substring(currentIndex);
      if (remaining) {
        parts.push(...parseMarkdown(remaining, key++));
      }
    }

    return parts.length > 0 ? parts : [input];
  };

  // Parser le markdown (titres, gras)
  const parseMarkdown = (text: string, baseKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const lines = text.split('\n');
    let key = baseKey;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parser les titres markdown (### Titre)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        const fontSize = `${20 - level * 2}px`;
        parts.push(
          <div key={key++} style={{ fontSize, fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {title}
          </div>
        );
        continue;
      }

      // Parser le gras markdown (**texte** ou __texte__)
      const boldPattern = /(\*\*|__)(.*?)\1/g;
      let lastIndex = 0;
      let boldMatch;
      const lineParts: React.ReactNode[] = [];

      while ((boldMatch = boldPattern.exec(line)) !== null) {
        // Ajouter le texte avant
        if (boldMatch.index > lastIndex) {
          lineParts.push(line.substring(lastIndex, boldMatch.index));
        }
        // Ajouter le texte en gras
        lineParts.push(
          <strong key={`bold-${key++}`}>{boldMatch[2]}</strong>
        );
        lastIndex = boldMatch.index + boldMatch[0].length;
      }

      // Ajouter le texte restant
      if (lastIndex < line.length) {
        lineParts.push(line.substring(lastIndex));
      }

      if (lineParts.length > 0) {
        parts.push(
          <span key={key++}>
            {lineParts}
          </span>
        );
      } else if (line) {
        parts.push(line);
      }

      // Ajouter un saut de ligne sauf pour la dernière ligne
      if (i < lines.length - 1) {
        parts.push(<br key={`br-${key++}`} />);
      }
    }

    return parts.length > 0 ? parts : [text];
  };

  const parsed = parseFormattedText(text);

  return (
    <div className={className}>
      {parsed}
    </div>
  );
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  group?: string;
  options?: { label: string; value: string; filter?: string }[];
  dependsOn?: string;
  dependsValue?: string;
  dependsOperator?: string; // Opérateur pour dependsOn (=, !=, >, <, etc.)
  relevant?: string; // Expression relevant complète
  noteText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  constraint?: string; // Expression de contrainte complète
  constraintMessage?: string; // Message d'erreur pour la contrainte
  appearance?: string; // Apparence du champ (field-list, signature, number, minimal, etc.)
  defaultValue?: any; // Valeur par défaut
  parameters?: string; // Paramètres (pour audit, etc.)
  order?: number; // Ordre d'apparition pour préserver l'ordre
  filterField?: string; // Champ de référence pour le filtrage
  choiceFilter?: string; // Expression choice_filter complète
}

export default function FormPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user?.role === 'SUPERADMIN' && params.id) {
      loadForm();
    }
  }, [params.id, user]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const data = await formsApi.getById(params.id as string);
      setForm(data);
      
      // Trier les versions par numéro de version (ordre décroissant)
      const sortedVersions = data.versions?.sort((a, b) => b.version - a.version) || [];
      const latestVersion = sortedVersions[0];
      
      if (latestVersion?.schema && latestVersion.schema.properties) {
        parseSchemaToFields(latestVersion.schema);
        extractGroupsFromSchema(latestVersion.schema);
      } else {
        setFields([]);
        setGroups([]);
      }
      
      // Initialiser les valeurs par défaut
      if (latestVersion?.schema && latestVersion.schema.properties) {
        const defaultValues: Record<string, any> = {};
        Object.entries(latestVersion.schema.properties).forEach(([name, prop]: [string, any]) => {
          if (prop.default !== undefined && prop.default !== null && prop.default !== '') {
            defaultValues[name] = prop.default;
          }
        });
        if (Object.keys(defaultValues).length > 0) {
          setFormData(defaultValues);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractGroupsFromSchema = (schema: any) => {
    if (!schema.properties) return;
    const groupOrderMap = new Map<string, number>(); // Map pour stocker l'ordre d'apparition de chaque groupe
    
    Object.entries(schema.properties).forEach(([name, prop]: [string, any], index) => {
      if (prop['x-group']) {
        const groupName = prop['x-group'];
        // Si le groupe n'a pas encore d'ordre, utiliser l'index du premier champ de ce groupe
        if (!groupOrderMap.has(groupName)) {
          groupOrderMap.set(groupName, prop['x-order'] !== undefined ? prop['x-order'] : index);
        }
      }
    });
    
    // Trier les groupes selon leur ordre d'apparition
    const sortedGroups = Array.from(groupOrderMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([groupName]) => groupName);
    
    setGroups(sortedGroups);
  };

  const parseSchemaToFields = (schema: any) => {
    if (!schema || !schema.properties) {
      setFields([]);
      return;
    }
    
    const parsedFields: FormField[] = [];
    
    Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
      // Ignorer les champs cachés (métadonnées) et les champs calculate
      if (prop['x-type'] === 'hidden' || prop['x-metadata'] === true) {
        return; // Ne pas afficher les champs métadonnées
      }

      let fieldType = prop['x-type'] || prop.type || 'text';
      
      // Ignorer les champs calculate (ils ne doivent pas s'afficher comme des questions)
      if (fieldType === 'calculate' || prop['x-displayOnly'] === true) {
        return; // Ne pas afficher les champs calculate
      }
      
      if (prop.type === 'array' && prop.items?.enum) {
        fieldType = 'select_multiple';
      } else if (prop.type === 'string' && prop.enum) {
        fieldType = 'select_one';
      }

      let options: { label: string; value: string; filter?: string }[] | undefined;
      if (prop['x-options'] && Array.isArray(prop['x-options']) && prop['x-options'].length > 0) {
        // Les options peuvent avoir une propriété filter
        options = prop['x-options'];
      } else if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
        options = prop.enum.map((val: string) => ({ label: val, value: val }));
      } else if (prop.items?.enum && Array.isArray(prop.items.enum) && prop.items.enum.length > 0) {
        options = prop.items.enum.map((val: string) => ({ label: val, value: val }));
      }

      parsedFields.push({
        name,
        label: prop.title || name,
        type: fieldType,
        required: schema.required?.includes(name) || false,
        group: prop['x-group'],
        dependsOn: prop['x-dependsOn'],
        dependsValue: prop['x-dependsValue'],
        dependsOperator: prop['x-dependsOperator'],
        relevant: prop['x-relevant'], // Expression relevant complète depuis le parser
        options: options,
        noteText: prop['x-noteText'],
        validation: {
          min: prop.minimum,
          max: prop.maximum,
          minLength: prop.minLength ?? prop['x-minLength'],
          maxLength: prop.maxLength ?? prop['x-maxLength'],
          pattern: prop.pattern,
        },
        constraint: prop['x-constraint'],
        constraintMessage: prop['x-constraintMessage'],
        appearance: prop['x-appearance'],
        defaultValue: prop.default,
        parameters: prop['x-auditParams'] || prop['x-parameters'],
        order: prop['x-order'] !== undefined ? prop['x-order'] : parsedFields.length, // Préserver l'ordre
        filterField: prop['x-filterField'],
        choiceFilter: prop['x-choiceFilter'],
      });
    });
    
    setFields(parsedFields);
  };

  // Évaluer une expression relevant complexe
  const evaluateRelevant = (expression: string): boolean => {
    if (!expression || expression.trim() === '') return true;
    
    const expr = expression.trim();
    
    // Gérer not()
    if (expr.startsWith('not(') && expr.endsWith(')')) {
      const innerExpr = expr.slice(4, -1).trim();
      return !evaluateRelevant(innerExpr);
    }
    
    // Gérer selected() - vérifier si une valeur est sélectionnée dans un select_multiple
    const selectedMatch = expr.match(/selected\(([^,]+),\s*['"]([^'"]+)['"]\)/);
    if (selectedMatch) {
      const fieldName = selectedMatch[1].trim().replace(/\$\{|\}/g, '');
      const expectedValue = selectedMatch[2].trim();
      const fieldValue = formData[fieldName];
      
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(expectedValue);
      }
      return fieldValue === expectedValue;
    }
    
    // Gérer count-selected() - compter les valeurs sélectionnées
    const countSelectedMatch = expr.match(/count-selected\(([^)]+)\)\s*(>=|<=|>|<|=)\s*(\d+)/);
    if (countSelectedMatch) {
      const fieldName = countSelectedMatch[1].trim().replace(/\$\{|\}/g, '');
      const operator = countSelectedMatch[2].trim();
      const expectedCount = parseInt(countSelectedMatch[3].trim(), 10);
      const fieldValue = formData[fieldName];
      
      const actualCount = Array.isArray(fieldValue) ? fieldValue.length : (fieldValue ? 1 : 0);
      
      switch (operator) {
        case '>=': return actualCount >= expectedCount;
        case '<=': return actualCount <= expectedCount;
        case '>': return actualCount > expectedCount;
        case '<': return actualCount < expectedCount;
        case '=': return actualCount === expectedCount;
        default: return false;
      }
    }
    
    // Gérer les opérateurs simples (=, !=, >, <, >=, <=)
    if (expr.includes('!=')) {
      const parts = expr.split('!=').map(p => p.trim());
      const left = parts[0].replace(/\$\{|\}/g, '');
      const right = parts[1].replace(/['"]/g, '').trim();
      return formData[left] !== right;
    }
    
    if (expr.includes('>=')) {
      const parts = expr.split('>=').map(p => p.trim());
      const left = parts[0].replace(/\$\{|\}/g, '');
      const right = parseFloat(parts[1].replace(/['"]/g, '').trim());
      return parseFloat(formData[left]) >= right;
    }
    
    if (expr.includes('<=')) {
      const parts = expr.split('<=').map(p => p.trim());
      const left = parts[0].replace(/\$\{|\}/g, '');
      const right = parseFloat(parts[1].replace(/['"]/g, '').trim());
      return parseFloat(formData[left]) <= right;
    }
    
    if (expr.includes('>')) {
      const parts = expr.split('>').map(p => p.trim());
      const left = parts[0].replace(/\$\{|\}/g, '');
      const right = parseFloat(parts[1].replace(/['"]/g, '').trim());
      return parseFloat(formData[left]) > right;
    }
    
    if (expr.includes('<')) {
      const parts = expr.split('<').map(p => p.trim());
      const left = parts[0].replace(/\$\{|\}/g, '');
      const right = parseFloat(parts[1].replace(/['"]/g, '').trim());
      return parseFloat(formData[left]) < right;
    }
    
    if (expr.includes('=')) {
      const parts = expr.split('=').map(p => p.trim());
      const left = parts[0].replace(/\$\{|\}/g, '');
      const right = parts[1].replace(/['"]/g, '').trim();
      
      // Gérer != '' (valeur non vide)
      if (right === '') {
        const value = formData[left];
        return value !== undefined && value !== null && value !== '';
      }
      
      return formData[left] === right;
    }
    
    // Si c'est juste un nom de champ, vérifier s'il a une valeur
    const fieldName = expr.replace(/\$\{|\}/g, '');
    if (fieldName && !expr.includes('(') && !expr.includes('=')) {
      const value = formData[fieldName];
      return value !== undefined && value !== null && value !== '';
    }
    
    return true;
  };

  // Vérifier si un champ doit être affiché selon ses dépendances
  const shouldShowField = (field: FormField): boolean => {
    // Si le champ a une expression relevant, l'évaluer
    if (field.relevant) {
      return evaluateRelevant(field.relevant);
    }
    
    // Sinon, utiliser la logique simple avec dependsOn
    if (!field.dependsOn) return true;
    
    const dependsOnValue = formData[field.dependsOn];
    
    if (field.dependsOperator === '!=') {
      return dependsOnValue !== field.dependsValue;
    }
    
    return dependsOnValue === field.dependsValue;
  };

  // Filtrer les options selon la dépendance hiérarchique
  const getFilteredOptions = (field: FormField): { label: string; value: string; filter?: string }[] => {
    if (!field.options) return [];
    
    // Déterminer le champ parent pour le filtrage
    let parentFieldName: string | null = null;
    let parentValue: any = null;
    
    // Cas 1: Le champ a un filterField explicite
    if (field.filterField) {
      parentFieldName = field.filterField;
      parentValue = formData[field.filterField];
    }
    // Cas 2: Extraire le champ parent depuis choiceFilter
    else if (field.choiceFilter) {
      const fieldRefMatch = field.choiceFilter.match(/\$\{([^}]+)\}/);
      if (fieldRefMatch) {
        parentFieldName = fieldRefMatch[1].trim();
        parentValue = formData[parentFieldName];
      }
    }
    // Cas 3: Déterminer automatiquement selon la hiérarchie géographique
    else {
      const fieldNameLower = field.name.toLowerCase();
      // Hiérarchie: province -> antenne -> zone -> aire
      if (fieldNameLower.includes('antenne') || fieldNameLower.includes('antenneid')) {
        // Les antennes sont filtrées par province
        parentFieldName = fields.find(f => 
          f.name.toLowerCase().includes('province') || f.name.toLowerCase().includes('provinceid')
        )?.name || null;
        if (parentFieldName) {
          parentValue = formData[parentFieldName];
        }
      } else if (fieldNameLower.includes('zone') || fieldNameLower.includes('zoneid')) {
        // Les zones sont filtrées par antenne ou province
        parentFieldName = fields.find(f => 
          (f.name.toLowerCase().includes('antenne') || f.name.toLowerCase().includes('antenneid')) ||
          (f.name.toLowerCase().includes('province') || f.name.toLowerCase().includes('provinceid'))
        )?.name || null;
        if (parentFieldName) {
          parentValue = formData[parentFieldName];
        }
      } else if (fieldNameLower.includes('aire') || fieldNameLower.includes('aireid')) {
        // Les aires sont filtrées par zone
        parentFieldName = fields.find(f => 
          f.name.toLowerCase().includes('zone') || f.name.toLowerCase().includes('zoneid')
        )?.name || null;
        if (parentFieldName) {
          parentValue = formData[parentFieldName];
        }
      }
    }
    
    // Si on a un champ parent et une valeur, filtrer les options
    if (parentFieldName && parentValue !== undefined && parentValue !== null && parentValue !== '') {
      const parentValueStr = String(parentValue).trim();
      
      // Filtrer les options selon leur propriété filter
      return field.options.filter((option) => {
        // Si l'option n'a pas de filtre, elle est toujours visible
        if (!option.filter || option.filter.trim() === '') {
          return true;
        }
        
        // Le filtre peut être:
        // 1. Une valeur simple (ex: "kinshasa", "haut_katanga", "likasi")
        // 2. Une expression XLSForm (ex: "${provinceId}='kinshasa'")
        
        const filterValue = option.filter.trim();
        
        // Cas 1: Filtre simple - comparaison directe avec la valeur du parent
        if (filterValue === parentValueStr) {
          return true;
        }
        
        // Cas 2: Expression XLSForm - parser l'expression
        // Format: ${fieldName}='value' ou ${fieldName}="value"
        const expressionMatch = filterValue.match(/\$\{([^}]+)\}\s*=\s*['"]([^'"]+)['"]/);
        if (expressionMatch) {
          const filterFieldName = expressionMatch[1].trim();
          const filterExpectedValue = expressionMatch[2].trim();
          
          // Vérifier si le champ parent correspond
          if (filterFieldName === parentFieldName && filterExpectedValue === parentValueStr) {
            return true;
          }
        }
        
        // Cas 3: Expression avec référence à un autre champ (ex: ${provinceId})
        // Si le filtre contient juste ${fieldName}, comparer avec la valeur du champ référencé
        const fieldRefMatch = filterValue.match(/\$\{([^}]+)\}/);
        if (fieldRefMatch) {
          const referencedFieldName = fieldRefMatch[1].trim();
          if (referencedFieldName === parentFieldName && formData[referencedFieldName] === parentValue) {
            return true;
          }
        }
        
        return false;
      });
    }
    
    // Si pas de champ parent ou pas de valeur, retourner toutes les options
    return field.options;
  };

  // Valider une contrainte
  const validateConstraint = (field: FormField, value: any): string | null => {
    if (!field.constraint || !value) return null;
    
    const constraint = field.constraint.trim();
    const valueStr = String(value).trim();
    
    // Gérer les regex
    const regexMatch = constraint.match(/regex\s*\([^,]+,\s*['"]([^'"]+)['"]\)/);
    if (regexMatch) {
      const pattern = regexMatch[1];
      try {
        const regex = new RegExp(pattern);
        if (!regex.test(valueStr)) {
          return field.constraintMessage || `La valeur ne correspond pas au format attendu`;
        }
      } catch (e) {
        console.error('Erreur dans la regex:', e);
      }
    }
    
    // Gérer les contraintes de longueur
    if (constraint.includes('string-length')) {
      const lengthMatch = constraint.match(/string-length\([^)]+\)\s*(>=|<=|=)\s*(\d+)/);
      if (lengthMatch) {
        const operator = lengthMatch[1];
        const expectedLength = parseInt(lengthMatch[2], 10);
        const actualLength = valueStr.length;
        
        switch (operator) {
          case '>=':
            if (actualLength < expectedLength) {
              return field.constraintMessage || `La longueur doit être d'au moins ${expectedLength} caractères`;
            }
            break;
          case '<=':
            if (actualLength > expectedLength) {
              return field.constraintMessage || `La longueur doit être d'au plus ${expectedLength} caractères`;
            }
            break;
          case '=':
            if (actualLength !== expectedLength) {
              return field.constraintMessage || `La longueur doit être exactement ${expectedLength} caractères`;
            }
            break;
        }
      }
    }
    
    return null;
  };

  const handleFieldChange = (name: string, value: any) => {
    // Trouver le champ pour valider
    const field = fields.find(f => f.name === name);
    if (field) {
      const error = validateConstraint(field, value);
      if (error) {
        setErrors((prev) => ({ ...prev, [name]: error }));
        return; // Ne pas mettre à jour si erreur
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Réinitialiser les champs dépendants si le champ parent change
    fields.forEach((field) => {
      if (field.dependsOn === name || (field.relevant && field.relevant.includes(name))) {
        setFormData((prev) => {
          const newData = { ...prev };
          delete newData[field.name];
          return newData;
        });
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data:', formData);
    alert('Données du formulaire:\n' + JSON.stringify(formData, null, 2));
  };

  const visibleFields = fields.filter(shouldShowField);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Formulaire non trouvé</p>
        <Link href="/dashboard/forms" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Retour à la liste
        </Link>
      </div>
    );
  }

  // Grouper les champs par groupe et trier selon l'ordre
  const groupedFields: Record<string, FormField[]> = {};
  const ungroupedFields: FormField[] = [];

  // Trier les champs visibles selon leur ordre avant de les grouper
  const sortedVisibleFields = [...visibleFields].sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : Infinity;
    const orderB = b.order !== undefined ? b.order : Infinity;
    return orderA - orderB;
  });

  sortedVisibleFields.forEach((field) => {
    if (field.group) {
      if (!groupedFields[field.group]) {
        groupedFields[field.group] = [];
      }
      groupedFields[field.group].push(field);
    } else {
      ungroupedFields.push(field);
    }
  });

  // Trier les champs dans chaque groupe selon leur ordre
  Object.keys(groupedFields).forEach((groupName) => {
    groupedFields[groupName].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      return orderA - orderB;
    });
  });

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{form.name}</h1>
          <p className="mt-2 text-sm text-gray-600">{form.description}</p>
          <p className="mt-1 text-xs text-gray-500">Mode prévisualisation - Collecte</p>
        </div>
        <Link
          href={`/dashboard/forms/${form.id}/builder`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Retour au builder
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Champs sans groupe */}
        {ungroupedFields.length > 0 && (
          <div className="space-y-4">
            {ungroupedFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
              </div>
            ))}
          </div>
        )}

        {/* Champs groupés */}
        {Object.entries(groupedFields).map(([groupName, groupFields]) => {
          // Vérifier si le groupe a une appearance field-list
          const firstField = groupFields[0];
          const groupSchema = form?.versions?.[0]?.schema?.properties?.[firstField?.name];
          const groupAppearance = groupSchema?.['x-groupAppearance'] || 'default';
          const isFieldList = groupAppearance === 'field-list' || groupAppearance?.toLowerCase().includes('field-list');
          
          return (
            <div key={groupName} className={`border-2 ${isFieldList ? 'border-gray-200' : 'border-blue-200'} rounded-lg p-4 ${isFieldList ? 'bg-white' : 'bg-blue-50'}`}>
              <h3 className={`text-lg font-semibold text-gray-900 mb-4 pb-2 border-b ${isFieldList ? 'border-gray-300' : 'border-blue-300'}`}>
                {groupName}
              </h3>
              <div className={isFieldList ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
                {groupFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {fields.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune question dans ce formulaire. Ajoutez des questions dans le builder.
          </div>
        )}

        {fields.length > 0 && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Soumettre
            </button>
          </div>
        )}
      </form>
    </div>
  );

  function renderField(field: FormField) {
    const value = formData[field.name] || '';
    const filteredOptions = getFilteredOptions(field);

    switch (field.type) {
      case 'select_one':
        const appearance = field.appearance?.toLowerCase() || '';
        const isMinimal = appearance.includes('minimal') || appearance.includes('compact');
        const isHorizontal = appearance.includes('horizontal');
        
        if (isHorizontal || isMinimal) {
          // Rendu horizontal ou minimal avec checkboxes/radio
          return (
            <div>
              <div className={`flex ${isHorizontal ? 'flex-wrap gap-2' : 'flex-col gap-2'}`}>
                {filteredOptions.map((opt) => (
                  <label key={opt.value} className={`flex items-center ${isHorizontal ? 'mr-4' : ''}`}>
                    <input
                      type="radio"
                      name={field.name}
                      value={opt.value}
                      checked={value === opt.value}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      className="mr-2"
                    />
                    <span className="text-gray-900">{opt.label}</span>
                  </label>
                ))}
              </div>
              {errors[field.name] && (
                <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
              )}
            </div>
          );
        }
        
        return (
          <div>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              required={field.required}
              className={`w-full border rounded-md px-3 py-2 text-gray-900 bg-white ${errors[field.name] ? 'border-red-500' : ''}`}
            >
              <option value="">Sélectionner...</option>
              {filteredOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        );

      case 'select_multiple':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {filteredOptions.map((opt) => (
              <label key={opt.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, opt.value]
                      : selectedValues.filter((v) => v !== opt.value);
                    handleFieldChange(field.name, newValues);
                  }}
                  className="mr-2"
                />
                <span className="text-gray-900">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'text':
        const isMultiline = field.appearance?.toLowerCase().includes('multiline');
        const isNumber = field.appearance?.toLowerCase().includes('number') || field.appearance?.toLowerCase().includes('numbers');
        
        if (isMultiline) {
          return (
            <div>
              <textarea
                value={value}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                required={field.required}
                rows={4}
                className={`w-full border rounded-md px-3 py-2 text-gray-900 bg-white ${errors[field.name] ? 'border-red-500' : ''}`}
                placeholder={field.label}
                minLength={field.validation?.minLength}
                maxLength={field.validation?.maxLength}
              />
              {errors[field.name] && (
                <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
              )}
            </div>
          );
        }
        
        return (
          <div>
            <input
              type={isNumber ? "number" : "text"}
              value={value}
              onChange={(e) => handleFieldChange(field.name, isNumber ? parseFloat(e.target.value) || '' : e.target.value)}
              required={field.required}
              className={`w-full border rounded-md px-3 py-2 text-gray-900 bg-white ${errors[field.name] ? 'border-red-500' : ''}`}
              placeholder={field.label}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
              pattern={field.validation?.pattern}
            />
            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        );

      case 'integer':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, parseInt(e.target.value) || '')}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            placeholder="0"
          />
        );

      case 'decimal':
        return (
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value) || '')}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            placeholder="0.0"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          />
        );

      case 'geopoint':
        return (
          <div className="border rounded-md px-3 py-2 bg-gray-50">
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      handleFieldChange(field.name, {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        altitude: position.coords.altitude,
                        accuracy: position.coords.accuracy,
                      });
                    },
                    (error) => {
                      alert('Erreur lors de la récupération de la position: ' + error.message);
                    }
                  );
                } else {
                  alert('La géolocalisation n\'est pas supportée par votre navigateur');
                }
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              📍 Obtenir la position GPS
            </button>
            {value && (
              <div className="mt-2 text-xs text-gray-600">
                Lat: {value.latitude}, Long: {value.longitude}
              </div>
            )}
          </div>
        );

      case 'image':
        const isSignature = field.appearance?.toLowerCase().includes('signature');
        const maxPixelsMatch = field.appearance?.match(/max-pixels=(\d+)/i);
        const maxPixels = maxPixelsMatch ? parseInt(maxPixelsMatch[1], 10) : undefined;
        
        if (isSignature) {
          // Utiliser le composant draw pour la signature
          return (
            <div className="border rounded-md p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Zone de signature</p>
              <canvas
                data-field={field.name}
                className="border border-gray-300 bg-white cursor-crosshair"
                width="400"
                height="200"
                onMouseDown={(e) => {
                  const canvas = e.currentTarget;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    const rect = canvas.getBoundingClientRect();
                    ctx.beginPath();
                    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                    
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      ctx.lineTo(moveEvent.clientX - rect.left, moveEvent.clientY - rect.top);
                      ctx.stroke();
                    };
                    
                    const onMouseUp = () => {
                      canvas.removeEventListener('mousemove', onMouseMove);
                      canvas.removeEventListener('mouseup', onMouseUp);
                      handleFieldChange(field.name, canvas.toDataURL());
                    };
                    
                    canvas.addEventListener('mousemove', onMouseMove);
                    canvas.addEventListener('mouseup', onMouseUp);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const canvas = document.querySelector(`canvas[data-field="${field.name}"]`) as HTMLCanvasElement;
                  if (canvas) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      handleFieldChange(field.name, '');
                    }
                  }
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
              >
                Effacer
              </button>
              {value && (
                <img src={value} alt="Signature" className="mt-2 max-w-xs rounded" />
              )}
            </div>
          );
        }
        
        return (
          <div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (maxPixels) {
                    // Redimensionner l'image si nécessaire
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        const ratio = Math.min(maxPixels / img.width, maxPixels / img.height);
                        canvas.width = img.width * ratio;
                        canvas.height = img.height * ratio;
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        handleFieldChange(field.name, canvas.toDataURL());
                      }
                    };
                    img.src = URL.createObjectURL(file);
                  } else {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      handleFieldChange(field.name, reader.result);
                    };
                    reader.readAsDataURL(file);
                  }
                }
              }}
              className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            />
            {value && (
              <img src={value} alt="Preview" className="mt-2 max-w-xs rounded" />
            )}
          </div>
        );

      case 'audio':
        return (
          <div>
            <input
              type="file"
              accept="audio/*"
              capture="user"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFieldChange(field.name, file.name);
                }
              }}
              className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            />
          </div>
        );

      case 'video':
        return (
          <div>
            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFieldChange(field.name, file.name);
                }
              }}
              className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            />
          </div>
        );

      case 'draw':
        return (
          <div className="border rounded-md p-4 bg-gray-50">
            <p className="text-sm text-gray-600 mb-2">Zone de signature</p>
            <canvas
              className="border border-gray-300 bg-white cursor-crosshair"
              width="400"
              height="200"
              onMouseDown={(e) => {
                const canvas = e.currentTarget;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.strokeStyle = '#000';
                  ctx.lineWidth = 2;
                  const rect = canvas.getBoundingClientRect();
                  ctx.beginPath();
                  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                  
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    ctx.lineTo(moveEvent.clientX - rect.left, moveEvent.clientY - rect.top);
                    ctx.stroke();
                  };
                  
                  const onMouseUp = () => {
                    canvas.removeEventListener('mousemove', onMouseMove);
                    canvas.removeEventListener('mouseup', onMouseUp);
                    handleFieldChange(field.name, canvas.toDataURL());
                  };
                  
                  canvas.addEventListener('mousemove', onMouseMove);
                  canvas.addEventListener('mouseup', onMouseUp);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    handleFieldChange(field.name, '');
                  }
                }
              }}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Effacer
            </button>
          </div>
        );

      case 'note':
        return (
          <div className="border rounded-md px-3 py-2 bg-gray-50">
            <FormattedText 
              text={field.label || field.noteText || 'Texte de la note'}
              className="text-gray-900"
              fields={fields}
              formData={formData}
            />
          </div>
        );

      case 'barcode':
        return (
          <div className="border rounded-md px-3 py-2 bg-gray-50">
            <p className="text-sm text-gray-600">Scanner le code-barres/QR code</p>
            <input
              type="text"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder="Entrer le code manuellement"
              className="mt-2 w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            />
          </div>
        );

      case 'acknowledge':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              required={field.required}
              className="mr-2"
            />
            <span className="text-gray-900">{field.label}</span>
          </label>
        );

      case 'calculate':
        return (
          <div className="border rounded-md px-3 py-2 bg-gray-50">
            <p className="text-sm text-gray-600">Champ calculé (non éditable)</p>
            <input
              type="text"
              value={value || '0'}
              disabled
              className="mt-2 w-full border rounded-md px-3 py-2 text-gray-500 bg-gray-100"
            />
          </div>
        );

      case 'hidden':
        return (
          <input
            type="hidden"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );

      case 'file':
        return (
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFieldChange(field.name, file.name);
              }
            }}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            required={field.required}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            placeholder={field.label}
          />
        );
    }
  }
}

