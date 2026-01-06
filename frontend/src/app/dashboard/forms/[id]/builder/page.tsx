'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAuthStore } from '../../../../../store/authStore';
import { formsApi } from '../../../../../lib/api/forms';
import { Form, Role } from '../../../../../types';
import AlertModal from '../../../../../components/Modal/AlertModal';
import ConfirmModal from '../../../../../components/Modal/ConfirmModal';

// Composant pour rendre le texte formaté (markdown/HTML)
function FormattedText({ 
  text, 
  className = '', 
  fields = [] 
}: { 
  text: string; 
  className?: string; 
  fields?: FormField[]; 
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
      
      // Chercher le champ référencé dans la liste des champs
      const referencedField = fields.find(f => f.name === fieldName);
      if (referencedField) {
        // Remplacer par le label du champ (dans le Forms Builder, on n'a pas de valeurs réelles)
        // On pourrait aussi afficher le nom du champ ou une valeur simulée
        const replacement = referencedField.label || fieldName;
        result = result.replace(match[0], replacement);
      } else {
        // Si le champ n'est pas trouvé, afficher le nom du champ
        result = result.replace(match[0], fieldName);
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
      id: string;
      name: string;
      label: string;
      type: string;
      required: boolean;
      group?: string;
      options?: { label: string; value: string; filter?: string }[]; // Ajout de filter pour les options
      dependsOn?: string;
      dependsValue?: string;
      noteText?: string;
      defaultValue?: string | number | boolean;
      validation?: {
        min?: number;
        max?: number;
        minLength?: number; // Longueur minimale pour les champs texte
        maxLength?: number; // Longueur maximale pour les champs texte
        pattern?: string;
        formula?: string; // Pour les champs calculate
      };
      order?: number; // Ordre d'apparition pour préserver l'ordre
      // Propriétés XlsForm
      relevant?: string; // Expression relevant complète
      constraint?: string; // Expression de contrainte complète
      choiceFilter?: string; // Expression choice_filter complète
      filterField?: string; // Champ de référence pour le filtrage
      filterValue?: string; // Valeur de référence pour le filtrage
      filterOperator?: string; // Opérateur du filtre (=, !=, etc.)
      repeat?: string; // Nom du groupe de répétition
      metadata?: boolean; // Indique si c'est un champ métadonnées
      displayOnly?: boolean; // Indique si c'est un champ en lecture seule (calculate)
      appearance?: string; // Apparence du champ (ex: number, multiline, etc.)
      parameters?: string; // Paramètres (pour audit, etc.)
    }

const FIELD_TYPES = [
  { id: 'select_one', label: 'Choix unique', icon: '🔘' },
  { id: 'select_multiple', label: 'Sélectionner plusieurs', icon: '☑️' },
  { id: 'text', label: 'Texte', icon: '📝' },
  { id: 'integer', label: 'Chiffre', icon: '🔢' },
  { id: 'decimal', label: 'Décimale', icon: '🔢' },
  { id: 'date', label: 'Date', icon: '📅' },
  { id: 'time', label: 'Heure', icon: '🕐' },
  { id: 'datetime', label: 'Date et heure', icon: '📆' },
  { id: 'geopoint', label: 'Position', icon: '📍' },
  { id: 'image', label: 'Photographie', icon: '📷' },
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'video', label: 'Vidéo', icon: '🎥' },
  { id: 'draw', label: 'Signature', icon: '✍️' },
  { id: 'note', label: 'Note', icon: '📄' },
  { id: 'barcode', label: 'Code-barres/code QR', icon: '📊' },
  { id: 'acknowledge', label: 'Consentir', icon: '✓' },
  { id: 'calculate', label: 'Calcul', icon: '🧮' },
  { id: 'hidden', label: 'Caché', icon: '👁️' },
  { id: 'file', label: 'Fichier', icon: '📁' },
];

// Composant draggable pour une question
function DraggableField({ 
  field, 
  index, 
  moveField, 
  renderFieldPreview 
}: { 
  field: FormField; 
  index: number; 
  moveField: (dragIndex: number, hoverIndex: number) => void;
  renderFieldPreview: (field: FormField) => React.ReactNode;
}) {
  const [{ isDragging }, drag] = useDrag({
    type: 'field',
    item: { id: field.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'field',
    hover: (draggedItem: { id: string; index: number }) => {
      if (draggedItem.index !== index) {
        moveField(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  const dragDropRef = (node: HTMLDivElement | null) => {
    drag(node);
    drop(node);
  };

  return (
    <div
      ref={dragDropRef}
      className={`border-b pb-4 ${isDragging ? 'opacity-50 bg-blue-100' : 'hover:bg-gray-50'} cursor-move transition-colors rounded-md p-2`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-400 text-lg select-none">⋮⋮</span>
        <span className="text-xs text-gray-500">Glisser pour réorganiser</span>
      </div>
      {renderFieldPreview(field)}
    </div>
  );
}

// Composant draggable pour un groupe
function DraggableGroup({
  groupName,
  groupFields,
  sortedGroups,
  allFields,
  moveGroup,
  moveField,
  renderFieldPreview,
  isCollapsed,
  onToggleCollapse,
}: {
  groupName: string;
  groupFields: FormField[];
  sortedGroups: string[];
  allFields: FormField[];
  moveGroup: (groupName: string, newPosition: number) => void;
  moveField: (dragIndex: number, hoverIndex: number) => void;
  renderFieldPreview: (field: FormField) => React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const groupIndex = sortedGroups.indexOf(groupName);
  
  const [{ isDragging }, drag] = useDrag({
    type: 'group',
    item: { groupName, index: groupIndex },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'group',
    hover: (draggedItem: { groupName: string; index: number }) => {
      if (draggedItem.index !== groupIndex) {
        moveGroup(draggedItem.groupName, groupIndex);
        draggedItem.index = groupIndex;
      }
    },
  });

  const dragDropRef = (node: HTMLDivElement | null) => {
    drag(node);
    drop(node);
  };

  // Obtenir les indices globaux des champs dans ce groupe
  const getGlobalFieldIndex = (fieldId: string) => {
    return allFields.findIndex(f => f.id === fieldId);
  };

  return (
    <div
      ref={dragDropRef}
      className={`border-2 border-blue-200 rounded-lg p-4 bg-blue-50 ${isDragging ? 'opacity-50 bg-blue-100' : 'hover:bg-blue-100'} transition-colors`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-400 text-lg select-none cursor-move">⋮⋮</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          className="text-gray-600 hover:text-gray-900 transition-transform flex-shrink-0"
          title={isCollapsed ? 'Développer' : 'Réduire'}
        >
          {isCollapsed ? (
            <span className="text-xl">▶</span>
          ) : (
            <span className="text-xl">▼</span>
          )}
        </button>
        <h3 className="text-lg font-semibold text-gray-900 flex-1 pb-2 border-b border-blue-300">
          {groupName}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({groupFields.length} {groupFields.length === 1 ? 'question' : 'questions'})
          </span>
        </h3>
        <span className="text-xs text-gray-500">Glisser pour réorganiser le groupe</span>
      </div>
      {!isCollapsed && (
        <div className="space-y-4">
          {groupFields.map((field) => {
            const globalIndex = getGlobalFieldIndex(field.id);
            return (
              <DraggableField
                key={field.id}
                field={field}
                index={globalIndex}
                moveField={moveField}
                renderFieldPreview={renderFieldPreview}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [selectedFieldType, setSelectedFieldType] = useState<string>('');
  const [fieldForm, setFieldForm] = useState<Partial<FormField>>({
    name: '',
    label: '',
    type: '',
    required: false,
  });
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [manuallyEditedOptionValues, setManuallyEditedOptionValues] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<string[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set()); // Groupes réduits
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsField, setSettingsField] = useState<FormField | null>(null);
  const [settingsForm, setSettingsForm] = useState<Partial<FormField>>({});
  
  // États pour la configuration de validation (liaison avec formulaire d'enregistrement)
  const [enregistrementForms, setEnregistrementForms] = useState<Form[]>([]);
  const [enregistrementFields, setEnregistrementFields] = useState<Array<{ name: string; label: string; type: string }>>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}); // Mapping: validationField -> enregistrementField
  const [showMappingModal, setShowMappingModal] = useState(false);
  
  // États pour la mise à jour XlsForm
  const [showUpdateXlsFormModal, setShowUpdateXlsFormModal] = useState(false);
  const [xlsFormFile, setXlsFormFile] = useState<File | null>(null);
  const [updatingXlsForm, setUpdatingXlsForm] = useState(false);
  
  // États pour les modales d'alerte et de confirmation
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });

  // Fonctions helper pour afficher les modales
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' = 'warning'
  ) => {
    setConfirmModal({ isOpen: true, title, message, type, onConfirm });
  };

  const loadEnregistrementForms = useCallback(async () => {
    try {
      const allForms = await formsApi.getAll();
      const enregistrementFormsList = allForms.filter(f => f.type === 'enregistrement');
      setEnregistrementForms(enregistrementFormsList);
    } catch (error) {
      console.error('Erreur lors du chargement des formulaires d\'enregistrement:', error);
    }
  }, []);

  const loadEnregistrementFields = useCallback(async () => {
    if (!form?.id) return;
    try {
      const data = await formsApi.getEnregistrementFields(form.id);
      setEnregistrementFields(data.fields);
    } catch (error) {
      console.error('Erreur lors du chargement des champs d\'enregistrement:', error);
      setEnregistrementFields([]);
    }
  }, [form?.id]);

  const extractGroupsFromSchema = useCallback((schema: any) => {
    if (!schema.properties) return;
    const groupSet = new Set<string>();
    Object.values(schema.properties).forEach((prop: any) => {
      if (prop['x-group']) {
        groupSet.add(prop['x-group']);
      }
    });
    setGroups(Array.from(groupSet)); // Pas de tri, garder l'ordre d'apparition
  }, []);

  const parseSchemaToFields = useCallback((schema: any) => {
    if (!schema || !schema.properties) {
      console.warn('Schema invalide ou vide:', schema);
      setFields([]);
      return;
    }
    
    console.log('Parsing schema:', schema);
    const parsedFields: FormField[] = [];
    
    Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
      try {
        // Ignorer les champs cachés (métadonnées) et les champs calculate
        if (prop['x-type'] === 'hidden' || prop['x-metadata'] === true) {
          return; // Ne pas afficher les champs métadonnées
        }

        // Déterminer le type de champ - priorité à x-type
        let fieldType = prop['x-type'] || prop.type || 'text';
        
        // Si c'est un array avec items.enum, c'est un select_multiple
        if (prop.type === 'array' && prop.items?.enum) {
          fieldType = 'select_multiple';
        }
        // Si c'est un string avec enum, c'est un select_one
        else if (prop.type === 'string' && prop.enum) {
          fieldType = 'select_one';
        }

        // Ignorer les champs calculate (ils ne doivent pas s'afficher comme des questions)
        if (prop['x-type'] === 'calculate') {
          return;
        }

        const field: FormField = {
          id: name,
          name,
          label: prop.title || name,
          type: fieldType,
          required: schema.required?.includes(name) || false,
          options: prop['x-options'] || (prop.enum ? prop.enum.map((val: string) => ({ label: val, value: val })) : []),
          group: prop['x-group'],
          order: prop['x-order'] !== undefined ? prop['x-order'] : parsedFields.length,
          relevant: prop['x-relevant'],
          constraint: prop['x-constraint'],
          appearance: prop['x-appearance'],
          defaultValue: prop.default,
          parameters: prop['x-auditParams'] || prop['x-parameters'],
          filterField: prop['x-filterField'],
          choiceFilter: prop['x-choiceFilter'],
        };
        
        console.log('Parsed field:', field);
      } catch (error) {
        console.error(`Erreur lors du parsing du champ ${name}:`, error, prop);
      }
    });
    
    // Trier les champs parsés par leur ordre pour garantir l'ordre correct lors du chargement
    // C'est nécessaire car Object.entries() ne garantit pas toujours l'ordre d'insertion
    const sortedFields = parsedFields.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      return orderA - orderB;
    });
    
    console.log('Total fields parsed:', sortedFields.length);
    setFields(sortedFields);
  }, []);

  const loadForm = useCallback(async () => {
    try {
      setLoading(true);
      console.log('=== Loading Form ===');
      console.log('Form ID:', params.id);
      
      const data = await formsApi.getById(params.id as string);
      setForm(data);
      
      // Trier les versions par numéro de version (ordre décroissant)
      const sortedVersions = data.versions?.sort((a, b) => b.version - a.version) || [];
      const latestVersion = sortedVersions[0];
      
      console.log('Form loaded:', {
        id: data.id,
        name: data.name,
        totalVersions: data.versions?.length || 0,
      });
      console.log('All versions:', data.versions?.map(v => ({
        version: v.version,
        isPublished: v.isPublished,
        createdAt: v.createdAt,
        propertiesCount: Object.keys(v.schema?.properties || {}).length,
      })));
      console.log('Latest version:', latestVersion ? {
        version: latestVersion.version,
        isPublished: latestVersion.isPublished,
        propertiesCount: Object.keys(latestVersion.schema?.properties || {}).length,
      } : 'none');
      
      if (latestVersion?.schema) {
        console.log('Schema found:', {
          type: latestVersion.schema.type,
          propertiesCount: Object.keys(latestVersion.schema.properties || {}).length,
          properties: Object.keys(latestVersion.schema.properties || {}),
        });
        console.log('Full schema:', JSON.stringify(latestVersion.schema, null, 2));
        
          // Charger les mappings de champs si présents
          if (latestVersion.schema['x-fieldMappings']) {
            setFieldMappings(latestVersion.schema['x-fieldMappings']);
          }

          if (latestVersion.schema.properties && Object.keys(latestVersion.schema.properties).length > 0) {
          console.log('Parsing schema with', Object.keys(latestVersion.schema.properties).length, 'properties');
          parseSchemaToFields(latestVersion.schema);
          extractGroupsFromSchema(latestVersion.schema);
          console.log('Schema parsed successfully');
        } else {
          console.warn('Schema exists but has no properties');
          console.warn('Schema structure:', JSON.stringify(latestVersion.schema, null, 2));
          setFields([]);
          setGroups([]);
        }
      } else {
        console.warn('No schema found in latest version');
        console.warn('Latest version:', latestVersion);
        setFields([]);
        setGroups([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showAlert('Erreur', 'Impossible de charger le formulaire', 'error');
    } finally {
      setLoading(false);
    }
  }, [params.id, parseSchemaToFields, extractGroupsFromSchema, showAlert]);

  const handleLinkEnregistrementForm = useCallback(async (formId: string) => {
    if (!form?.id) return;
    try {
      await formsApi.update(form.id, { linkedEnregistrementFormId: formId });
      setForm((prev) => prev ? { ...prev, linkedEnregistrementFormId: formId } : null);
      await loadEnregistrementFields();
      showAlert('Succès', 'Formulaire d\'enregistrement lié avec succès', 'success');
    } catch (error: any) {
      showAlert('Erreur', error.response?.data?.message || 'Erreur lors de la liaison', 'error');
    }
  }, [form?.id, loadEnregistrementFields, showAlert]);

  useEffect(() => {
    if ((user?.role === Role.SUPERADMIN) && params.id) {
      loadForm();
    }
  }, [params.id, user, loadForm]);

  // Bloquer l'accès pour ADMIN (peut voir les données mais pas éditer)
  if (user?.role === Role.ADMIN) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Accès non autorisé. Vous pouvez consulter les données du formulaire mais pas l'éditer.</p>
        <Link href={`/dashboard/forms/${params.id}/data`} className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Voir les données du formulaire
        </Link>
      </div>
    );
  }

  useEffect(() => {
    if (form?.type === 'validation') {
      loadEnregistrementForms();
      if (form.linkedEnregistrementFormId) {
        loadEnregistrementFields();
      }
    }
  }, [form?.type, form?.linkedEnregistrementFormId, loadEnregistrementForms, loadEnregistrementFields]);

  const fieldsToSchema = (fields: FormField[]) => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    console.log('Converting', fields.length, 'fields to schema');

    // Trier les champs par leur ordre avant de les convertir en schéma
    // pour garantir que l'ordre est préservé dans le schéma
    const sortedFields = [...fields].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      return orderA - orderB;
    });

    // Utiliser les champs dans l'ordre où ils ont été placés (utiliser field.order)
    sortedFields.forEach((field) => {
      if (!field.name || !field.name.trim()) {
        console.warn(`Field has no name, skipping:`, field);
        return;
      }

      if (!field.type) {
        console.warn(`Field ${field.name} has no type, defaulting to 'text'`);
      }

      const prop: any = {
        title: field.label || field.name,
        'x-type': field.type || 'text', // Sauvegarder le type personnalisé pour le rechargement
      };

      // Définir le type selon le type de champ
      if (field.type === 'select_one') {
        prop.type = 'string';
        prop.enum = field.options?.map(opt => opt.value).filter(Boolean) || [];
        prop['x-options'] = field.options || [];
      } else if (field.type === 'select_multiple') {
        prop.type = 'array';
        prop.items = {
          type: 'string',
          enum: field.options?.map(opt => opt.value).filter(Boolean) || [],
        };
        prop['x-options'] = field.options || [];
      } else if (field.type === 'integer') {
        prop.type = 'integer';
      } else if (field.type === 'decimal') {
        prop.type = 'number';
      } else if (field.type === 'geopoint') {
        prop.type = 'object';
      } else {
        prop.type = 'string';
      }

      if (field.type === 'note') {
        prop['x-type'] = 'note';
        // Pour les champs note, le texte est dans le label (title)
        // On ne stocke pas noteText séparément, tout est dans le label
        prop.type = 'string';
        prop.readOnly = true;
      }

      if (field.group) {
        prop['x-group'] = field.group;
      }

      // Sauvegarder l'ordre d'apparition (utiliser field.order au lieu de index)
      prop['x-order'] = field.order !== undefined ? field.order : 0;

      if (field.validation) {
        if (field.validation.min !== undefined) prop.minimum = field.validation.min;
        if (field.validation.max !== undefined) prop.maximum = field.validation.max;
        if (field.validation.minLength !== undefined) {
          prop.minLength = field.validation.minLength;
          prop['x-minLength'] = field.validation.minLength;
        }
        if (field.validation.maxLength !== undefined) {
          prop.maxLength = field.validation.maxLength;
          prop['x-maxLength'] = field.validation.maxLength;
        }
      }

      if (field.dependsOn) {
        prop['x-dependsOn'] = field.dependsOn;
        prop['x-dependsValue'] = field.dependsValue;
      }

      if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
        prop['default'] = field.defaultValue;
      }

      // Pour les champs note, le texte est dans le label (title), pas besoin de x-noteText

      if (field.validation?.formula) {
        prop['x-calculate'] = field.validation.formula;
      }

      // Sauvegarder les propriétés XlsForm
      if (field.choiceFilter) {
        prop['x-choiceFilter'] = field.choiceFilter;
      }
      if (field.filterField) {
        prop['x-filterField'] = field.filterField;
      }
      if (field.filterValue) {
        prop['x-filterValue'] = field.filterValue;
      }
      if (field.filterOperator) {
        prop['x-filterOperator'] = field.filterOperator;
      }
      if (field.repeat) {
        prop['x-repeat'] = field.repeat;
      }
      if (field.metadata) {
        prop['x-metadata'] = field.metadata;
      }
      if (field.displayOnly) {
        prop['x-displayOnly'] = field.displayOnly;
      }
      if (field.appearance) {
        prop['x-appearance'] = field.appearance;
      }

      // S'assurer que les options incluent la propriété filter si présente
      if (field.options && field.options.length > 0) {
        prop['x-options'] = field.options.map(opt => ({
          label: opt.label,
          value: opt.value,
          ...(opt.filter && { filter: opt.filter }), // Inclure filter si présent
        }));
      }

      properties[field.name] = prop;
      if (field.required) {
        required.push(field.name);
      }

      console.log(`Field ${field.name} (${field.type}) added to schema`);
    });

    const schema: any = {
      type: 'object',
      properties,
      required,
    };

    // Ajouter les mappings de champs si présents (pour les formulaires de validation)
    if (Object.keys(fieldMappings).length > 0) {
      schema['x-fieldMappings'] = fieldMappings;
    }

    console.log('Schema generated:', {
      propertiesCount: Object.keys(properties).length,
      requiredCount: required.length,
      properties: Object.keys(properties),
    });

    return schema;
  };

  const handleAddField = () => {
    setEditingField(null);
    setFieldForm({ name: '', label: '', type: '', required: false });
    setSelectedFieldType('');
    setNameManuallyEdited(false);
    setManuallyEditedOptionValues(new Set());
    setShowFieldModal(true);
  };

  const handleSelectFieldType = (type: string) => {
    setSelectedFieldType(type);
    const initialOptions = (type === 'select_one' || type === 'select_multiple') 
      ? [{ label: '', value: '' }] 
      : undefined;
    setFieldForm({ ...fieldForm, type, options: initialOptions });
    setManuallyEditedOptionValues(new Set()); // Réinitialiser pour le nouveau type
  };

  const handleSaveField = () => {
    if (!fieldForm.name || !fieldForm.label || !fieldForm.type) {
      showAlert('Champs obligatoires', 'Veuillez remplir tous les champs obligatoires', 'warning');
      return;
    }

    // Valider les options pour les champs select
    if ((fieldForm.type === 'select_one' || fieldForm.type === 'select_multiple')) {
      if (!fieldForm.options || fieldForm.options.length === 0) {
        showAlert('Options requises', 'Veuillez ajouter au moins une option pour ce type de champ', 'warning');
        return;
      }
      // Filtrer les options vides ou sans valeur
      const validOptions = fieldForm.options.filter(opt => opt.label && opt.label.trim() && opt.value && opt.value.trim());
      if (validOptions.length === 0) {
        showAlert('Options requises', 'Veuillez ajouter au moins une option valide pour ce type de champ', 'warning');
        return;
      }
      fieldForm.options = validOptions;
    }

    const newField: FormField = {
      id: editingField?.id || fieldForm.name,
      name: fieldForm.name.trim(),
      label: fieldForm.label.trim(),
      type: fieldForm.type,
      required: fieldForm.required || false,
      group: fieldForm.group?.trim() || undefined,
      options: (fieldForm.options && fieldForm.options.length > 0) ? fieldForm.options : undefined,
      dependsOn: fieldForm.dependsOn?.trim() || undefined,
      dependsValue: fieldForm.dependsValue?.trim() || undefined,
      // Pour les champs note, le texte est dans le label, pas dans noteText
      noteText: fieldForm.type === 'note' ? undefined : (fieldForm.noteText?.trim() || undefined),
      validation: fieldForm.validation,
      choiceFilter: fieldForm.choiceFilter,
      filterField: fieldForm.filterField,
      appearance: fieldForm.appearance,
    };

    console.log('Saving field:', newField);

    if (editingField) {
      const updatedFields = fields.map(f => f.id === editingField.id ? { ...newField, order: f.order } : f);
      setFields(updatedFields);
      console.log('Field updated, total fields:', fields.length);
    } else {
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.order || 0), -1) : -1;
      const fieldWithOrder = { ...newField, order: maxOrder + 1 };
      setFields([...fields, fieldWithOrder]);
      console.log('Field added, total fields:', fields.length + 1);
    }

    setShowFieldModal(false);
    setEditingField(null);
    setFieldForm({ name: '', label: '', type: '', required: false });
    setSelectedFieldType('');
    setNameManuallyEdited(false);
    setManuallyEditedOptionValues(new Set());
  };

  const handleEditField = (field: FormField) => {
    setEditingField(field);
    setFieldForm(field);
    setSelectedFieldType(field.type);
    setNameManuallyEdited(true); // Le nom est déjà défini, donc considéré comme modifié manuellement
    setManuallyEditedOptionValues(new Set()); // Réinitialiser pour l'édition
    setShowFieldModal(true);
  };

  const handleDeleteField = (id: string) => {
    showConfirm(
      'Supprimer la question',
      'Êtes-vous sûr de vouloir supprimer cette question ? Cette action est irréversible.',
      () => {
        setFields(fields.filter(f => f.id !== id));
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      'danger'
    );
  };

  const handleSaveSettings = () => {
    if (!settingsField) return;

    const updatedFields = fields.map(f => 
      f.id === settingsField.id 
        ? {
            ...f,
            required: settingsForm.required ?? f.required,
            dependsOn: settingsForm.dependsOn,
            dependsValue: settingsForm.dependsValue,
            noteText: settingsForm.noteText,
            defaultValue: settingsForm.defaultValue,
            validation: settingsForm.validation,
            appearance: settingsForm.appearance,
            choiceFilter: settingsForm.choiceFilter,
            filterField: settingsForm.filterField,
            // Préserver les options existantes
            options: f.options,
          }
        : f
    );
    
    setFields(updatedFields);
    setShowSettingsModal(false);
    setSettingsField(null);
    setSettingsForm({});
  };

  const handleSaveSchema = async () => {
    try {
      if (fields.length === 0) {
        showAlert('Avertissement', 'Aucune question à sauvegarder. Ajoutez au moins une question avant de sauvegarder.', 'warning');
        return;
      }

      const schema = fieldsToSchema(fields);
      console.log('Saving schema with fields:', fields.length);
      console.log('Generated schema:', JSON.stringify(schema, null, 2));
      
      const sortedVersions = form?.versions?.sort((a, b) => b.version - a.version) || [];
      const latestVersion = sortedVersions[0];
      const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

      console.log('Creating version:', nextVersion);

      const savedVersion = await formsApi.createVersion(form!.id, {
        schema,
        isPublished: false,
      });

      console.log('=== Version Saved Successfully ===');
      console.log('Saved version:', savedVersion);
      console.log('Saved version schema:', JSON.stringify(savedVersion.schema, null, 2));
      console.log('Saved schema properties count:', Object.keys(savedVersion.schema?.properties || {}).length);
      console.log('Saved schema properties:', Object.keys(savedVersion.schema?.properties || {}));

      showAlert('Succès', `Schéma sauvegardé avec succès (Version ${nextVersion})`, 'success');
      
      // Mettre à jour le formulaire localement avec la nouvelle version pour éviter la perte de données
      setForm((prev) => {
        if (!prev) return prev;
        const updatedVersions = [...(prev.versions || []), savedVersion];
        return {
          ...prev,
          versions: updatedVersions,
        };
      });
      
      // Recharger le formulaire après un délai pour laisser le temps à la base de données
      setTimeout(async () => {
        console.log('=== Reloading form from server ===');
        try {
          const reloadedData = await formsApi.getById(form!.id);
          console.log('Reloaded form:', reloadedData);
          console.log('Reloaded versions:', reloadedData.versions?.map(v => ({
            version: v.version,
            isPublished: v.isPublished,
            propertiesCount: Object.keys(v.schema?.properties || {}).length,
          })));
          
          const reloadedSortedVersions = reloadedData.versions?.sort((a, b) => b.version - a.version) || [];
          const reloadedLatestVersion = reloadedSortedVersions[0];
          console.log('Reloaded latest version:', reloadedLatestVersion);
          console.log('Reloaded latest version schema:', reloadedLatestVersion?.schema);
          console.log('Reloaded latest version schema properties:', reloadedLatestVersion?.schema?.properties);
          
          if (reloadedLatestVersion?.schema) {
            if (reloadedLatestVersion.schema.properties && Object.keys(reloadedLatestVersion.schema.properties).length > 0) {
              console.log('Reloaded schema properties:', Object.keys(reloadedLatestVersion.schema.properties));
              parseSchemaToFields(reloadedLatestVersion.schema);
              extractGroupsFromSchema(reloadedLatestVersion.schema);
              setForm(reloadedData);
              console.log('Form reloaded successfully with', Object.keys(reloadedLatestVersion.schema.properties).length, 'properties');
            } else {
              console.error('Schema exists but has no properties!');
              console.error('Schema structure:', JSON.stringify(reloadedLatestVersion.schema, null, 2));
              showAlert('Erreur', 'Le schéma existe mais ne contient aucune propriété. Vérifiez les logs de la console.', 'error');
            }
          } else {
            console.error('No schema found in latest version after reload!');
            console.error('Latest version:', reloadedLatestVersion);
            console.error('All versions:', reloadedData.versions);
            showAlert('Erreur', 'Le schéma n\'a pas été trouvé dans la dernière version après le rechargement. Vérifiez les logs de la console et du serveur.', 'error');
          }
        } catch (error) {
          console.error('Error reloading form:', error);
          showAlert('Erreur', 'Erreur lors du rechargement du formulaire', 'error');
        }
      }, 1000);
    } catch (error: any) {
      console.error('Error saving schema:', error);
      showAlert('Erreur', error.response?.data?.message || 'Erreur lors de la sauvegarde', 'error');
    }
  };

  const handlePublish = async () => {
    showConfirm(
      'Publier le formulaire',
      'Êtes-vous sûr de vouloir publier cette version du formulaire ?',
      async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          // Trier les versions pour obtenir la dernière version
          const sortedVersions = form?.versions?.sort((a, b) => b.version - a.version) || [];
          const latestVersion = sortedVersions[0];
          
          if (latestVersion) {
            await formsApi.publishVersion(form!.id, latestVersion.version);
            showAlert('Succès', 'Formulaire publié avec succès. Utilisez le bouton "Envoyer" pour le rendre disponible dans l\'application mobile.', 'success');
            
            // Recharger le formulaire pour mettre à jour le statut
            await loadForm();
          } else {
            showAlert('Avertissement', 'Aucune version à publier. Veuillez d\'abord sauvegarder le formulaire.', 'warning');
          }
        } catch (error: any) {
          showAlert('Erreur', error.response?.data?.message || 'Erreur lors de la publication', 'error');
        }
      },
      'info'
    );
  };

  const handleSendToMobile = async () => {
    showConfirm(
      'Envoyer aux applications mobiles',
      'Êtes-vous sûr de vouloir envoyer ce formulaire aux applications mobiles ? Il apparaîtra automatiquement dans l\'application mobile sans téléchargement.',
      async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          const sortedVersions = form?.versions?.sort((a, b) => b.version - a.version) || [];
          const latestVersion = sortedVersions[0];
          
          if (latestVersion && latestVersion.isPublished) {
            await formsApi.sendToMobile(form!.id, latestVersion.version);
            showAlert('Succès', 'Formulaire envoyé aux applications mobiles avec succès. Il apparaîtra automatiquement dans l\'application mobile.', 'success');
            
            // Recharger le formulaire pour mettre à jour le statut
            await loadForm();
          } else {
            showAlert('Avertissement', 'Le formulaire doit être publié avant d\'être envoyé aux mobiles.', 'warning');
          }
        } catch (error: any) {
          showAlert('Erreur', error.response?.data?.message || 'Erreur lors de l\'envoi', 'error');
        }
      },
      'info'
    );
  };

  const handleRetractFromMobile = async () => {
    showConfirm(
      'Retirer des applications mobiles',
      'Êtes-vous sûr de vouloir retirer ce formulaire des applications mobiles ? Il ne sera plus disponible dans l\'application mobile.',
      async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          const sortedVersions = form?.versions?.sort((a, b) => b.version - a.version) || [];
          const latestVersion = sortedVersions[0];
          
          if (latestVersion) {
            await formsApi.retractFromMobile(form!.id, latestVersion.version);
            showAlert('Succès', 'Formulaire retiré des applications mobiles avec succès.', 'success');
            
            // Recharger le formulaire pour mettre à jour le statut
            await loadForm();
          }
        } catch (error: any) {
          showAlert('Erreur', error.response?.data?.message || 'Erreur lors du retrait', 'error');
        }
      },
      'warning'
    );
  };

  const handleAddGroup = () => {
    if (newGroupName.trim() && !groups.includes(newGroupName.trim())) {
      setGroups([...groups, newGroupName.trim()]); // Pas de tri, ajouter à la fin
      setNewGroupName('');
      setShowGroupModal(false);
      // Sélectionner automatiquement le nouveau groupe dans le formulaire
      setFieldForm({ ...fieldForm, group: newGroupName.trim() });
    }
  };

  const renderFieldPreview = (field: FormField) => {
    const dependsOnField = field.dependsOn ? fields.find(f => f.name === field.dependsOn) : null;
    const dependsOnValue = dependsOnField && field.dependsValue 
      ? dependsOnField.options?.find(o => o.value === field.dependsValue)?.label 
      : null;

    return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <label className="text-sm font-medium text-gray-900">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </label>
          <span className="text-xs text-gray-900 bg-gray-100 px-2 py-1 rounded">
            {field.type}
          </span>
          {field.dependsOn && dependsOnValue && (
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded" title={`Dépend de: ${dependsOnField?.label} = ${dependsOnValue}`}>
              ⚡ Si {dependsOnField?.label} = {dependsOnValue}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSettingsField(field);
              setSettingsForm({
                required: field.required,
                dependsOn: field.dependsOn,
                dependsValue: field.dependsValue,
                noteText: field.noteText,
                defaultValue: field.defaultValue,
                validation: field.validation,
                appearance: field.appearance,
                choiceFilter: field.choiceFilter,
                filterField: field.filterField,
              });
              setShowSettingsModal(true);
            }}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            title="Paramètres"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => handleEditField(field)}
            className="px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-xs font-medium"
            title="Modifier"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteField(field.id)}
            className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded text-xs font-medium"
            title="Supprimer"
          >
            Delete
          </button>
        </div>
      </div>
      {field.type === 'select_one' && (
        <select className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white" disabled>
          <option>Sélectionner...</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {field.type === 'select_multiple' && (
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center">
              <input type="checkbox" disabled className="mr-2" />
              <span className="text-gray-900">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
      {field.type === 'text' && (
        <input
          type="text"
          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          disabled
          placeholder={field.label}
        />
      )}
      {field.type === 'integer' && (
        <input
          type="number"
          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          disabled
          placeholder="0"
        />
      )}
      {field.type === 'date' && (
        <input
          type="date"
          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
          disabled
        />
      )}
      {field.type === 'geopoint' && (
        <div className="border rounded-md px-3 py-2 text-gray-500">
          📍 Position GPS
        </div>
      )}
      {field.type === 'image' && (
        <div className="border rounded-md px-3 py-2 text-gray-500">
          📷 Photographie
        </div>
      )}
      {field.type === 'draw' && (
        <div className="border rounded-md px-3 py-2 text-gray-500">
          ✍️ Signature
        </div>
      )}
      {field.type === 'note' && (
        <div className="border rounded-md px-3 py-2 bg-gray-50">
          <FormattedText 
            text={field.label || 'Texte de la note'}
            className="text-gray-900"
            fields={fields}
          />
        </div>
      )}
    </>
    );
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!form) {
    return <div className="text-center py-12">Formulaire non trouvé</div>;
  }

  // Fonction pour réorganiser les champs
  const moveField = (dragIndex: number, hoverIndex: number) => {
    const newFields = [...fields];
    const draggedField = newFields[dragIndex];
    newFields.splice(dragIndex, 1);
    newFields.splice(hoverIndex, 0, draggedField);
    
    // Mettre à jour l'ordre
    const updatedFields = newFields.map((field, index) => ({
      ...field,
      order: index,
    }));
    
    setFields(updatedFields);
  };

  // Fonction pour déplacer un champ vers un groupe
  const moveFieldToGroup = (fieldId: string, targetGroup: string | null) => {
    setFields(fields.map(field => 
      field.id === fieldId 
        ? { ...field, group: targetGroup || undefined }
        : field
    ));
  };

  // Fonction pour réorganiser les groupes (en déplaçant le premier champ de chaque groupe)
  const moveGroup = (groupName: string, newPosition: number) => {
    const groupFieldsToMove = fields.filter(f => f.group === groupName);
    if (groupFieldsToMove.length === 0) return;
    
    const allFields = [...fields];
    
    // Utiliser les champs dans l'ordre où ils ont été placés (pas de tri)
    // Séparer les champs par groupe et les champs sans groupe
    const fieldsByGroup: Record<string, FormField[]> = {};
    const ungroupedFields: FormField[] = [];
    const groupOrder: string[] = []; // Ordre d'apparition des groupes
    
    allFields.forEach(field => {
      if (field.group) {
        if (!fieldsByGroup[field.group]) {
          fieldsByGroup[field.group] = [];
          groupOrder.push(field.group); // Ajouter le groupe dans l'ordre d'apparition
        }
        fieldsByGroup[field.group].push(field);
      } else {
        ungroupedFields.push(field);
      }
    });
    
    // Utiliser l'ordre d'apparition des groupes (pas de tri)
    const currentGroupOrder = groupOrder;
    
    // Trouver l'index actuel du groupe à déplacer
    const currentIndex = currentGroupOrder.indexOf(groupName);
    
    if (currentIndex === -1 || currentIndex === newPosition || newPosition < 0 || newPosition >= currentGroupOrder.length) {
      return;
    }
    
    // Réorganiser les groupes
    const reorderedGroups = [...currentGroupOrder];
    const [movedGroup] = reorderedGroups.splice(currentIndex, 1);
    reorderedGroups.splice(newPosition, 0, movedGroup);
    
    // Recalculer l'ordre de tous les champs
    let currentOrder = 0;
    const reorderedFields: FormField[] = [];
    
    // Ajouter d'abord les champs sans groupe
    ungroupedFields.forEach(field => {
      reorderedFields.push({ ...field, order: currentOrder++ });
    });
    
    // Ajouter les champs des groupes dans le nouvel ordre
    reorderedGroups.forEach(group => {
      if (fieldsByGroup[group]) {
        fieldsByGroup[group].forEach(field => {
          reorderedFields.push({ ...field, order: currentOrder++ });
        });
      }
    });
    
    setFields(reorderedFields);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{form.name}</h1>
          <p className="mt-2 text-sm text-gray-600">{form.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              // Ouvrir le formulaire en mode prévisualisation/collecte
              router.push(`/dashboard/forms/${form!.id}/preview`);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Visualiser
          </button>
          <button
            onClick={() => {
              showConfirm(
                'Annuler les modifications',
                'Annuler les modifications non sauvegardées ? Toutes les modifications locales seront perdues.',
                () => {
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  loadForm(); // Recharger depuis le serveur
                },
                'warning'
              );
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              showConfirm(
                'Quitter',
                'Quitter sans sauvegarder ? Toutes les modifications non sauvegardées seront perdues.',
                () => {
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  router.push('/dashboard/forms');
                },
                'warning'
              );
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Quitter
          </button>
          <button
            onClick={handleSaveSchema}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Sauvegarder
          </button>
          <button
            onClick={() => setShowUpdateXlsFormModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            title="Mettre à jour depuis un fichier XlsForm"
          >
            Mettre à jour XlsForm
          </button>
          {(() => {
            const sortedVersions = form?.versions?.sort((a, b) => b.version - a.version) || [];
            const latestVersion = sortedVersions[0];
            const isPublished = latestVersion?.isPublished || false;
            const isSentToMobile = latestVersion?.isSentToMobile || false;

            return (
              <>
                {(user?.role === Role.SUPERADMIN) && (
                  <>
                    {!isPublished && (
                      <button
                        onClick={handlePublish}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Publier
                      </button>
                    )}
                    {isPublished && !isSentToMobile && (
                      <button
                        onClick={handleSendToMobile}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Envoyer
                      </button>
                    )}
                    {isPublished && isSentToMobile && (
                      <button
                        onClick={handleRetractFromMobile}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Retirer
                      </button>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Section de configuration pour les formulaires de validation - Sélection du formulaire d'enregistrement */}
      {form.type === 'validation' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Configuration de validation</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formulaire d'enregistrement lié
            </label>
            <select
              value={form.linkedEnregistrementFormId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleLinkEnregistrementForm(e.target.value);
                }
              }}
              className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            >
              <option value="">Sélectionner un formulaire d'enregistrement</option>
              {enregistrementForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Sélectionnez le formulaire d'enregistrement des prestataires pour pré-remplir automatiquement les champs lors de la validation.
            </p>
            {form.linkedEnregistrementFormId && (
              <p className="mt-2 text-sm text-blue-600">
                ✓ Formulaire lié. La section de mapping apparaîtra après le champ "ID" dans le formulaire.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Aperçu du formulaire</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGroupModal(true)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Gérer les groupes
            </button>
            <button
              onClick={handleAddField}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              + Ajouter une question
            </button>
          </div>
        </div>
        <div className="space-y-6">
          {fields.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucune question ajoutée. Cliquez sur "Ajouter une question" pour commencer.
            </div>
          ) : (
            (() => {
              // Utiliser les champs dans l'ordre où ils ont été placés (pas de tri)
              // Grouper les champs par groupe en préservant l'ordre
              const groupedFields: Record<string, FormField[]> = {};
              const ungroupedFields: FormField[] = [];
              const groupOrder: string[] = []; // Ordre d'apparition des groupes
              
              fields.forEach((field) => {
                if (field.group) {
                  if (!groupedFields[field.group]) {
                    groupedFields[field.group] = [];
                    groupOrder.push(field.group); // Ajouter le groupe dans l'ordre d'apparition
                  }
                  groupedFields[field.group].push(field);
                } else {
                  ungroupedFields.push(field);
                }
              });

              // Utiliser les groupes dans l'ordre où ils apparaissent (pas de tri)
              const sortedGroupNames = groupOrder.filter(groupName => 
                groupedFields[groupName] && groupedFields[groupName].length > 0
              );

              // Trouver le champ "ID" (peut être dans ungroupedFields ou dans un groupe)
              const idField = fields.find(f => f.name.toLowerCase() === 'id' || f.label.toLowerCase() === 'id');
              const idFieldGroup = idField?.group;
              const idFieldIsUngrouped = idField && !idField.group;
              
              // Composant pour la section de mapping (réutilisable)
              const MappingSection = () => {
                if (form.type !== 'validation' || !form.linkedEnregistrementFormId) return null;
                
                return (
                  <div className="mt-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-semibold text-gray-900">Mapping des champs</h3>
                      <button
                        onClick={() => setShowMappingModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                      >
                        Configurer le mapping
                      </button>
                    </div>
                    
                    {Object.keys(fieldMappings).length > 0 ? (
                      <div className="border rounded-md overflow-hidden bg-white">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Champ de validation</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Champ d'enregistrement</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(fieldMappings).map(([validationField, enregistrementField]) => {
                              const field = fields.find(f => f.name === validationField);
                              const enregistrementFieldData = enregistrementFields.find(f => f.name === enregistrementField);
                              return (
                                <tr key={validationField}>
                                  <td className="px-4 py-3 text-sm text-gray-900">{field?.label || validationField}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{enregistrementFieldData?.label || enregistrementField}</td>
                                  <td className="px-4 py-3 text-sm">
                                    <button
                                      onClick={() => {
                                        const newMappings = { ...fieldMappings };
                                        delete newMappings[validationField];
                                        setFieldMappings(newMappings);
                                      }}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      Supprimer
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Aucun mapping configuré. Cliquez sur "Configurer le mapping" pour commencer.</p>
                    )}
                  </div>
                );
              };
              
              return (
                <>
                  {/* Questions sans groupe */}
                  {ungroupedFields.length > 0 && (
                    <div className="space-y-4">
                      {ungroupedFields.map((field) => {
                        const globalIndex = fields.findIndex(f => f.id === field.id);
                        const isIdField = (field.name.toLowerCase() === 'id' || field.label.toLowerCase() === 'id');
                        
                        return (
                          <div key={field.id}>
                            <DraggableField
                              field={field}
                              index={globalIndex}
                              moveField={moveField}
                              renderFieldPreview={renderFieldPreview}
                            />
                            {/* Afficher la section de mapping juste après le champ ID */}
                            {isIdField && idFieldIsUngrouped && <MappingSection />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Questions groupées - affichées dans l'ordre de placement (pas de tri) */}
                  {sortedGroupNames.map((groupName) => {
                    const groupFields = groupedFields[groupName];
                    const hasIdField = groupFields.some(f => f.name.toLowerCase() === 'id' || f.label.toLowerCase() === 'id');
                    const shouldShowMapping = hasIdField && idFieldGroup === groupName && !collapsedGroups.has(groupName);
                    
                    return (
                      <div key={groupName}>
                        <DraggableGroup
                          groupName={groupName}
                          groupFields={groupFields}
                          sortedGroups={sortedGroupNames}
                          allFields={fields}
                          moveGroup={moveGroup}
                          moveField={moveField}
                          renderFieldPreview={renderFieldPreview}
                          isCollapsed={collapsedGroups.has(groupName)}
                          onToggleCollapse={() => {
                            setCollapsedGroups(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(groupName)) {
                                newSet.delete(groupName);
                              } else {
                                newSet.add(groupName);
                              }
                              return newSet;
                            });
                          }}
                        />
                        {/* Afficher la section de mapping juste après le groupe contenant le champ ID */}
                        {shouldShowMapping && <MappingSection />}
                      </div>
                    );
                  })}
                </>
              );
            })()
          )}
        </div>
      </div>

      {showFieldModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowFieldModal(false)}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {editingField ? 'Modifier la question' : 'Ajouter une question'}
                  </h3>
                  {selectedFieldType && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsField({
                          id: editingField?.id || '',
                          name: fieldForm.name || '',
                          label: fieldForm.label || '',
                          type: selectedFieldType,
                          required: fieldForm.required || false,
                          group: fieldForm.group,
                          options: fieldForm.options,
                          dependsOn: fieldForm.dependsOn,
                          dependsValue: fieldForm.dependsValue,
                          noteText: fieldForm.noteText,
                          defaultValue: fieldForm.defaultValue,
                          validation: fieldForm.validation,
                          order: fieldForm.order || 0,
                          choiceFilter: fieldForm.choiceFilter,
                          filterField: fieldForm.filterField,
                          appearance: fieldForm.appearance,
                        });
                        setSettingsForm({
                          required: fieldForm.required,
                          dependsOn: fieldForm.dependsOn,
                          dependsValue: fieldForm.dependsValue,
                          noteText: fieldForm.noteText,
                          defaultValue: fieldForm.defaultValue,
                          validation: fieldForm.validation,
                          choiceFilter: fieldForm.choiceFilter,
                          filterField: fieldForm.filterField,
                          appearance: fieldForm.appearance,
                        });
                        setShowSettingsModal(true);
                      }}
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
                      title="Paramètres avancés"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>

                {!selectedFieldType ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Sélectionnez un type de champ :
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {FIELD_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => handleSelectFieldType(type.id)}
                          className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                          <span className="text-lg flex-shrink-0">{type.icon}</span>
                          <span className="text-xs font-medium text-gray-900 text-left flex-1">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {selectedFieldType === 'note' ? 'Texte de la note' : 'Libellé'}
                      </label>
                      {selectedFieldType === 'note' ? (
                        <textarea
                          value={fieldForm.label || ''}
                          onChange={(e) => {
                            const newLabel = e.target.value;
                            // Si le nom n'a pas été modifié manuellement, le synchroniser avec le libellé
                            let newName = fieldForm.name || '';
                            if (!nameManuallyEdited && !editingField) {
                              // Convertir le libellé en nom technique : minuscules, espaces remplacés par underscores, caractères spéciaux supprimés
                              newName = newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                            }
                            setFieldForm({ 
                              ...fieldForm, 
                              label: newLabel,
                              name: newName
                            });
                          }}
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Saisissez le texte de la note"
                          rows={6}
                          required
                        />
                      ) : (
                        <input
                          type="text"
                          value={fieldForm.label || ''}
                          onChange={(e) => {
                            const newLabel = e.target.value;
                            // Si le nom n'a pas été modifié manuellement, le synchroniser avec le libellé
                            let newName = fieldForm.name || '';
                            if (!nameManuallyEdited && !editingField) {
                              // Convertir le libellé en nom technique : minuscules, espaces remplacés par underscores, caractères spéciaux supprimés
                              newName = newLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                            }
                            setFieldForm({ 
                              ...fieldForm, 
                              label: newLabel,
                              name: newName
                            });
                          }}
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="ex: Nom du prestataire"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nom du champ (technique)
                      </label>
                      <input
                        type="text"
                        value={fieldForm.name || ''}
                        onChange={(e) => {
                          setNameManuallyEdited(true);
                          setFieldForm({ ...fieldForm, name: e.target.value });
                        }}
                        className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                        placeholder="ex: nom, prenom, telephone"
                        disabled={!!editingField}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Généré automatiquement depuis le libellé (modifiable)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Groupe
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={fieldForm.group || ''}
                          onChange={(e) =>
                            setFieldForm({ ...fieldForm, group: e.target.value || undefined })
                          }
                          className="flex-1 border rounded-md px-3 py-2 text-gray-900 bg-white"
                        >
                          <option value="">Aucun groupe</option>
                          {groups.map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowGroupModal(true)}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium"
                          title="Créer un nouveau groupe"
                        >
                          + Nouveau
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={fieldForm.required || false}
                          onChange={(e) =>
                            setFieldForm({
                              ...fieldForm,
                              required: e.target.checked,
                            })
                          }
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Champ obligatoire</span>
                      </label>
                    </div>

                    {/* Dépendance/Hiérarchisation */}
                    {(selectedFieldType === 'select_one' ||
                      selectedFieldType === 'select_multiple') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dépend de (hiérarchisation)
                        </label>
                        <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Question précédente
                            </label>
                            <select
                              value={fieldForm.dependsOn || ''}
                              onChange={(e) => {
                                const dependsOn = e.target.value || undefined;
                                setFieldForm({
                                  ...fieldForm,
                                  dependsOn,
                                  dependsValue: undefined, // Réinitialiser la valeur si on change la question
                                });
                              }}
                              className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                            >
                              <option value="">Aucune dépendance</option>
                              {fields
                                .filter((f) => 
                                  f.type === 'select_one' || f.type === 'select_multiple'
                                )
                                .filter((f) => editingField ? f.id !== editingField.id : true)
                                .map((f) => (
                                  <option key={f.id} value={f.name}>
                                    {f.label}
                                  </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                              Cette question s'affichera uniquement si la question sélectionnée a la valeur spécifiée ci-dessous
                            </p>
                          </div>
                          
                          {fieldForm.dependsOn && (() => {
                            const dependsOnField = fields.find(f => f.name === fieldForm.dependsOn);
                            return dependsOnField && dependsOnField.options && dependsOnField.options.length > 0 ? (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Valeur requise
                                </label>
                                <select
                                  value={fieldForm.dependsValue || ''}
                                  onChange={(e) =>
                                    setFieldForm({
                                      ...fieldForm,
                                      dependsValue: e.target.value || undefined,
                                    })
                                  }
                                  className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                                >
                                  <option value="">Sélectionner une valeur</option>
                                  {dependsOnField.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label} ({opt.value})
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                  Cette question s'affichera uniquement si "{dependsOnField.label}" = "{dependsOnField.options.find(o => o.value === fieldForm.dependsValue)?.label || '...'}"
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-yellow-600">
                                La question sélectionnée n'a pas encore d'options définies. Ajoutez d'abord les options à cette question.
                              </p>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {(selectedFieldType === 'select_one' ||
                      selectedFieldType === 'select_multiple') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Options
                        </label>
                        <div className="space-y-2">
                          {(fieldForm.options || []).map((opt, index) => (
                            <div key={index} className="space-y-2 p-3 border rounded-md bg-gray-50">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 flex items-center border rounded-md px-3 py-2 bg-white">
                                  <input
                                    type="text"
                                    value={opt.label}
                                    onChange={(e) => {
                                      const newLabel = e.target.value;
                                      const newOptions = [...(fieldForm.options || [])];
                                      newOptions[index].label = newLabel;
                                      // Générer automatiquement la valeur si elle n'a pas été modifiée manuellement
                                      if (!manuallyEditedOptionValues.has(index)) {
                                        const generatedValue = newLabel
                                          .toLowerCase()
                                          .replace(/\s+/g, '_')
                                          .replace(/[^a-z0-9_]/g, '');
                                        newOptions[index].value = generatedValue;
                                      }
                                      setFieldForm({ ...fieldForm, options: newOptions });
                                    }}
                                    placeholder="Label"
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                    className="flex-1 text-gray-900 bg-transparent border-none outline-none"
                                  />
                                  <span className="text-gray-400 mx-2">|</span>
                                  <input
                                    type="text"
                                    value={opt.value}
                                    onChange={(e) => {
                                      const newOptions = [...(fieldForm.options || [])];
                                      newOptions[index].value = e.target.value;
                                      setFieldForm({ ...fieldForm, options: newOptions });
                                      // Marquer cette valeur comme modifiée manuellement
                                      setManuallyEditedOptionValues(new Set(manuallyEditedOptionValues).add(index));
                                    }}
                                    placeholder="Valeur"
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    spellCheck="false"
                                    className="flex-1 text-blue-600 bg-transparent border-none outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newOptions = [...(fieldForm.options || [])];
                                    newOptions.splice(index, 1);
                                    setFieldForm({ ...fieldForm, options: newOptions });
                                    // Retirer l'index de l'ensemble des valeurs modifiées manuellement
                                    const newManuallyEdited = new Set(manuallyEditedOptionValues);
                                    newManuallyEdited.delete(index);
                                    // Ajuster les index pour les options après celle supprimée
                                    const adjustedManuallyEdited = new Set<number>();
                                    newManuallyEdited.forEach((idx) => {
                                      if (idx < index) {
                                        adjustedManuallyEdited.add(idx);
                                      } else if (idx > index) {
                                        adjustedManuallyEdited.add(idx - 1);
                                      }
                                    });
                                    setManuallyEditedOptionValues(adjustedManuallyEdited);
                                  }}
                                  className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                                  title="Supprimer cette option"
                                >
                                  ✕
                                </button>
                              </div>
                              {/* Champ filter pour le filtrage dynamique */}
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Filtre (optionnel) - Format: {'${'}champ_ref{'}'} = 'valeur'
                                </label>
                                <input
                                  type="text"
                                  value={opt.filter || ''}
                                  onChange={(e) => {
                                    const newOptions = [...(fieldForm.options || [])];
                                    newOptions[index].filter = e.target.value || undefined;
                                    setFieldForm({ ...fieldForm, options: newOptions });
                                  }}
                                  placeholder="Ex: ${province} = 'kinshasa'"
                                  className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm font-mono"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                  <strong>Important :</strong> Utilisez la <strong>valeur (value)</strong> du champ référencé, pas le label. 
                                  Ex: si "Province" a la valeur "kinshasa", utilisez {'${'}province{'}'} = 'kinshasa' (en minuscules, comme la valeur).
                                </p>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newOptions = [...(fieldForm.options || []), { label: '', value: '', filter: undefined }];
                              setFieldForm({ ...fieldForm, options: newOptions });
                            }}
                            className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                          >
                            <span className="text-lg">+</span>
                            <span>Ajouter une option</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {(selectedFieldType === 'integer' ||
                      selectedFieldType === 'decimal') && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum
                          </label>
                          <input
                            type="number"
                            value={fieldForm.validation?.min || ''}
                            onChange={(e) =>
                              setFieldForm({
                                ...fieldForm,
                                validation: {
                                  ...fieldForm.validation,
                                  min: e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined,
                                },
                              })
                            }
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Maximum
                          </label>
                          <input
                            type="number"
                            value={fieldForm.validation?.max || ''}
                            onChange={(e) =>
                              setFieldForm({
                                ...fieldForm,
                                validation: {
                                  ...fieldForm.validation,
                                  max: e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined,
                                },
                              })
                            }
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                          />
                        </div>
                      </div>
                    )}


                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowFieldModal(false);
                          setSelectedFieldType('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveField}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                      >
                        {editingField ? 'Modifier' : 'Ajouter'}
                      </button>
                    </div>s
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour gérer les groupes */}
      {showGroupModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowGroupModal(false);
                setNewGroupName('');
              }}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Gérer les groupes
                </h3>
                
                {/* Liste des groupes existants */}
                {groups.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Groupes existants ({groups.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {groups.map((group) => {
                        const groupFieldsCount = fields.filter(f => f.group === group).length;
                        return (
                          <div
                            key={group}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div>
                              <span className="text-sm font-medium text-gray-900">{group}</span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({groupFieldsCount} question{groupFieldsCount > 1 ? 's' : ''})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                showConfirm(
                                  'Supprimer le groupe',
                                  `Supprimer le groupe "${group}" ? Les questions seront déplacées hors groupe.`,
                                  () => {
                                    setConfirmModal({ ...confirmModal, isOpen: false });
                                    // Retirer le groupe de toutes les questions
                                    setFields(fields.map(f => 
                                      f.group === group ? { ...f, group: undefined } : f
                                    ));
                                    // Retirer le groupe de la liste
                                    setGroups(groups.filter(g => g !== group));
                                  },
                                  'danger'
                                );
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Créer un nouveau groupe */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Créer un nouveau groupe
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddGroup();
                        }
                      }}
                      className="flex-1 border rounded-md px-3 py-2 text-gray-900 bg-white"
                      placeholder="ex: Localisation, Identification, Contact..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                    >
                      Créer
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Les groupes permettent d'organiser les questions par catégories (ex: Localisation, Identification, etc.)
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupModal(false);
                    setNewGroupName('');
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de paramètres */}
      {showSettingsModal && settingsField && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => {
              setShowSettingsModal(false);
              setSettingsField(null);
              setSettingsForm({});
            }}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Paramètres : {settingsField.label}
                </h3>

                <div className="space-y-4">
                  {/* Réponse obligatoire */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settingsForm.required ?? settingsField.required}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            required: e.target.checked,
                          })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Réponse obligatoire</span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500">
                      Si activé, cette question devra être remplie avant de passer à la suivante
                    </p>
                  </div>

                  {/* Réponse par défaut */}
                  {settingsField.type !== 'note' && settingsField.type !== 'calculate' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Réponse par défaut
                      </label>
                      {settingsField.type === 'select_one' || settingsField.type === 'select_multiple' ? (
                        <select
                          value={settingsForm.defaultValue as string || ''}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              defaultValue: e.target.value || undefined,
                            })
                          }
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                        >
                          <option value="">Aucune valeur par défaut</option>
                          {settingsField.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : settingsField.type === 'integer' || settingsField.type === 'decimal' ? (
                        <input
                          type="number"
                          value={settingsForm.defaultValue as number || ''}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              defaultValue: e.target.value ? (settingsField.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value)) : undefined,
                            })
                          }
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Valeur par défaut"
                        />
                      ) : settingsField.type === 'date' ? (
                        <input
                          type="date"
                          value={settingsForm.defaultValue as string || ''}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              defaultValue: e.target.value || undefined,
                            })
                          }
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                        />
                      ) : settingsField.type === 'time' ? (
                        <input
                          type="time"
                          value={settingsForm.defaultValue as string || ''}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              defaultValue: e.target.value || undefined,
                            })
                          }
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                        />
                      ) : (
                        <input
                          type="text"
                          value={settingsForm.defaultValue as string || ''}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              defaultValue: e.target.value || undefined,
                            })
                          }
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Valeur par défaut"
                        />
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Cette valeur sera préremplie lorsque l'utilisateur ouvre le formulaire
                      </p>
                    </div>
                  )}

                  {/* Note / Texte d'aide - Masquer pour les types note et calculate */}
                  {settingsField.type !== 'note' && settingsField.type !== 'calculate' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Note / Texte d'aide
                      </label>
                      <textarea
                        value={settingsForm.noteText || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            noteText: e.target.value || undefined,
                          })
                        }
                        className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                        rows={3}
                        placeholder="Texte d'aide ou instructions pour cette question"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Ce texte apparaîtra sous la question pour guider l'utilisateur
                      </p>
                    </div>
                  )}

                  {/* Filtrage dynamique (pour les champs select_one) */}
                  {(settingsField.type === 'select_one' || settingsField.type === 'select_multiple') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filtrage dynamique (Choice Filter)
                      </label>
                      <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Ce champ dépend de (pour filtrer les options)
                          </label>
                          <select
                            value={settingsForm.filterField || ''}
                            onChange={(e) => {
                              const filterField = e.target.value || undefined;
                              // Si un filterField est sélectionné mais qu'il n'y a pas de choiceFilter, en générer un
                              let choiceFilter = settingsForm.choiceFilter;
                              if (filterField && !choiceFilter) {
                                // Générer un choiceFilter de base
                                choiceFilter = `\${${filterField}} = ''`;
                              } else if (!filterField) {
                                // Si on retire le filterField, retirer aussi le choiceFilter
                                choiceFilter = undefined;
                              }
                              setSettingsForm({
                                ...settingsForm,
                                filterField,
                                choiceFilter,
                              });
                            }}
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                          >
                            <option value="">Aucun filtre</option>
                            {fields
                              .filter((f) => f.id !== settingsField.id)
                              .filter((f) => 
                                f.type === 'select_one' || 
                                f.type === 'select_multiple' ||
                                f.type === 'text' ||
                                f.type === 'integer' ||
                                f.type === 'decimal'
                              )
                              .map((f) => (
                                <option key={f.id} value={f.name}>
                                  {f.label}
                                </option>
                              ))}
                          </select>
                          <p className="mt-1 text-xs text-gray-500">
                            Les options de ce champ seront filtrées selon la valeur du champ sélectionné. 
                            <strong> Important :</strong> Configurez le filtre pour chaque option dans le modal d'édition du champ (bouton "Edit").
                            Le format du filtre doit être : {'${'}nom_du_champ{'}'} = 'valeur' où <strong>valeur</strong> est la <strong>valeur (value)</strong> de l'option, pas le label.
                            Ex: si "Province" a la valeur "kinshasa", utilisez {'${'}province{'}'} = 'kinshasa'
                          </p>
                        </div>
                        {settingsForm.filterField && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Expression choice_filter (optionnel - généré automatiquement)
                            </label>
                            <input
                              type="text"
                              value={settingsForm.choiceFilter || ''}
                              onChange={(e) =>
                                setSettingsForm({
                                  ...settingsForm,
                                  choiceFilter: e.target.value || undefined,
                                })
                              }
                              className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm font-mono"
                              placeholder="Ex: ${province} = 'Kinshasa'"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Expression complète du filtre. Généralement générée automatiquement à partir du filterField.
                              <strong> Note :</strong> Les filtres utilisent les valeurs (value) des options, pas les labels.
                            </p>
                          </div>
                        )}
                        {/* Afficher les options avec leurs filtres */}
                        {settingsField.options && settingsField.options.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">
                              Options et leurs filtres
                            </label>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {settingsField.options.map((opt, index) => (
                                <div key={index} className="p-2 bg-white border rounded text-xs">
                                  <div className="font-medium text-gray-900">{opt.label} ({opt.value})</div>
                                  {opt.filter ? (
                                    <div className="mt-1 text-gray-600 font-mono text-xs">
                                      Filtre: {opt.filter}
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-gray-400 italic text-xs">
                                      Aucun filtre
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              Pour modifier les options et leurs filtres, utilisez le bouton "Edit" sur le champ.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dépendance / Hiérarchisation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dépendance (Hiérarchisation)
                    </label>
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Cette question dépend de
                        </label>
                        <select
                          value={settingsForm.dependsOn || ''}
                          onChange={(e) => {
                            const dependsOn = e.target.value || undefined;
                            setSettingsForm({
                              ...settingsForm,
                              dependsOn,
                              dependsValue: undefined, // Réinitialiser la valeur si on change la question
                            });
                          }}
                          className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                        >
                          <option value="">Aucune dépendance</option>
                          {fields
                            .filter((f) => f.id !== settingsField.id)
                            .filter((f) => 
                              f.type === 'select_one' || 
                              f.type === 'select_multiple' ||
                              f.type === 'text' ||
                              f.type === 'integer' ||
                              f.type === 'decimal' ||
                              f.type === 'date' ||
                              f.type === 'boolean'
                            )
                            .map((f) => (
                              <option key={f.id} value={f.name}>
                                {f.label}
                              </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Cette question s'affichera uniquement si la question sélectionnée a une valeur spécifique
                        </p>
                      </div>
                      
                      {settingsForm.dependsOn && (() => {
                        const dependsOnField = fields.find(f => f.name === settingsForm.dependsOn);
                        if (dependsOnField && (dependsOnField.type === 'select_one' || dependsOnField.type === 'select_multiple') && dependsOnField.options && dependsOnField.options.length > 0) {
                          return (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Valeur requise
                              </label>
                              <select
                                value={settingsForm.dependsValue || ''}
                                onChange={(e) =>
                                  setSettingsForm({
                                    ...settingsForm,
                                    dependsValue: e.target.value || undefined,
                                  })
                                }
                                className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                              >
                                <option value="">Sélectionner une valeur</option>
                                {dependsOnField.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label} ({opt.value})
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-gray-500">
                                Cette question s'affichera uniquement si "{dependsOnField.label}" = "{dependsOnField.options.find(o => o.value === settingsForm.dependsValue)?.label || '...'}"
                              </p>
                            </div>
                          );
                        } else if (dependsOnField && dependsOnField.type !== 'select_one' && dependsOnField.type !== 'select_multiple') {
                          return (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Valeur requise
                              </label>
                              <input
                                type="text"
                                value={settingsForm.dependsValue as string || ''}
                                onChange={(e) =>
                                  setSettingsForm({
                                    ...settingsForm,
                                    dependsValue: e.target.value || undefined,
                                  })
                                }
                                className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                                placeholder="Valeur exacte requise"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Cette question s'affichera uniquement si "{dependsOnField.label}" = la valeur saisie
                              </p>
                            </div>
                          );
                        } else {
                          return (
                            <p className="text-xs text-yellow-600">
                              La question sélectionnée n'a pas encore d'options définies. Ajoutez d'abord les options à cette question.
                            </p>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  {/* Validation (pour les nombres) */}
                  {(settingsField.type === 'integer' || settingsField.type === 'decimal') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Validation (Valeurs min/max)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Minimum</label>
                          <input
                            type="number"
                            value={settingsForm.validation?.min ?? ''}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                validation: {
                                  ...settingsForm.validation,
                                  min: e.target.value ? parseFloat(e.target.value) : undefined,
                                },
                              })
                            }
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                            placeholder="Min"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Maximum</label>
                          <input
                            type="number"
                            value={settingsForm.validation?.max ?? ''}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                validation: {
                                  ...settingsForm.validation,
                                  max: e.target.value ? parseFloat(e.target.value) : undefined,
                                },
                              })
                            }
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                            placeholder="Max"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validation (pour les champs texte - limites de caractères) */}
                  {settingsField.type === 'text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Validation (Limites de caractères)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Longueur minimale</label>
                          <input
                            type="number"
                            min="0"
                            value={settingsForm.validation?.minLength ?? ''}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                validation: {
                                  ...settingsForm.validation,
                                  minLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                },
                              })
                            }
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                            placeholder="Ex: 5"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Longueur maximale</label>
                          <input
                            type="number"
                            min="0"
                            value={settingsForm.validation?.maxLength ?? ''}
                            onChange={(e) =>
                              setSettingsForm({
                                ...settingsForm,
                                validation: {
                                  ...settingsForm.validation,
                                  maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                },
                              })
                            }
                            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                            placeholder="Ex: 10"
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Définissez le nombre minimum et maximum de caractères autorisés pour ce champ
                      </p>
                    </div>
                  )}

                  {/* Apparence (pour les champs texte) */}
                  {settingsField.type === 'text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Apparence
                      </label>
                      <select
                        value={settingsForm.appearance || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            appearance: e.target.value || undefined,
                          })
                        }
                        className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white text-sm"
                      >
                        <option value="">Par défaut (texte normal)</option>
                        <option value="number">Nombre (clavier numérique uniquement)</option>
                        <option value="multiline">Multiligne (zone de texte)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Définissez l'apparence du champ. "Nombre" affichera uniquement le clavier numérique.
                      </p>
                    </div>
                  )}

                  {/* Formule de calcul (pour les champs calculate) */}
                  {settingsField.type === 'calculate' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Formule de calcul
                      </label>
                      <input
                        type="text"
                        value={settingsForm.validation?.formula || ''}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            validation: {
                              ...settingsForm.validation,
                              formula: e.target.value || undefined,
                            },
                          })
                        }
                        className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white font-mono text-sm"
                        placeholder="ex: champ1 + champ2, champ1 * 2, etc."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Utilisez les noms des champs pour référencer leurs valeurs (ex: nom_du_champ1 + nom_du_champ2)
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setSettingsField(null);
                    setSettingsForm({});
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'alerte */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Modale de confirmation */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={() => {
          confirmModal.onConfirm();
        }}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {/* Modale de configuration du mapping */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration du mapping des champs</h3>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {fields.map((field) => {
                  // Exclure les champs de type note et calculate du mapping
                  if (field.type === 'note' || field.type === 'calculate') {
                    return null;
                  }
                  
                  return (
                    <div key={field.id} className="border rounded-md p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label} ({field.name})
                      </label>
                      <select
                        value={fieldMappings[field.name] || ''}
                        onChange={(e) => {
                          const newMappings = { ...fieldMappings };
                          if (e.target.value) {
                            newMappings[field.name] = e.target.value;
                          } else {
                            delete newMappings[field.name];
                          }
                          setFieldMappings(newMappings);
                        }}
                        className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                      >
                        <option value="">Aucun mapping</option>
                        {enregistrementFields.map((ef) => (
                          <option key={ef.name} value={ef.name}>
                            {ef.label} ({ef.name}) - {ef.type}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowMappingModal(false);
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale de mise à jour XlsForm */}
      {showUpdateXlsFormModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Mettre à jour depuis un fichier XlsForm
              </h3>
              <button
                onClick={() => {
                  setShowUpdateXlsFormModal(false);
                  setXlsFormFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!xlsFormFile) {
                  showAlert('Erreur', 'Veuillez sélectionner un fichier', 'error');
                  return;
                }

                setUpdatingXlsForm(true);
                try {
                  const result = await formsApi.updateXlsForm(
                    form!.id,
                    xlsFormFile
                  );
                  showAlert('Succès', result.message, 'success');
                  setShowUpdateXlsFormModal(false);
                  setXlsFormFile(null);
                  // Recharger le formulaire
                  await loadForm();
                } catch (error: any) {
                  showAlert(
                    'Erreur',
                    error.response?.data?.message || 'Erreur lors de la mise à jour du fichier XlsForm',
                    'error'
                  );
                } finally {
                  setUpdatingXlsForm(false);
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fichier XlsForm (.xlsx ou .xls)
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setXlsFormFile(file);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
                    required
                  />
                  {xlsFormFile && (
                    <p className="mt-1 text-sm text-gray-600">
                      Fichier sélectionné: {xlsFormFile.name}
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Attention :</strong> Cette action créera une nouvelle version du formulaire avec le nouveau schéma XlsForm. 
                    Les modifications manuelles non sauvegardées seront perdues.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateXlsFormModal(false);
                    setXlsFormFile(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updatingXlsForm || !xlsFormFile}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {updatingXlsForm ? 'Mise à jour...' : 'Mettre à jour'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </DndProvider>
  );
}

