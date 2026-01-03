'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formsApi } from '../../../../lib/api/forms';
import AlertModal from '../../../../components/Modal/AlertModal';

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  group?: string;
  options?: { label: string; value: string }[];
  dependsOn?: string;
  dependsValue?: string;
  noteText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  order?: number;
}

export default function PublicFormPage() {
  const params = useParams();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);

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

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    if (params.id) {
      loadForm();
    }
  }, [params.id]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const data = await formsApi.getPublic(params.id as string);
      setForm(data);
      
      if (data.schema) {
        parseSchemaToFields(data.schema);
        extractGroupsFromSchema(data.schema);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement:', error);
      showAlert('Erreur', error.message || 'Impossible de charger le formulaire', 'error');
    } finally {
      setLoading(false);
    }
  };

  const extractGroupsFromSchema = (schema: any) => {
    if (!schema.properties) return;
    const groupSet = new Set<string>();
    const groupOrder: string[] = [];
    Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
      if (prop['x-group'] && !groupOrder.includes(prop['x-group'])) {
        groupSet.add(prop['x-group']);
        groupOrder.push(prop['x-group']);
      }
    });
    setGroups(groupOrder);
  };

  const parseSchemaToFields = (schema: any) => {
    if (!schema || !schema.properties) {
      setFields([]);
      return;
    }
    
    const parsedFields: FormField[] = [];
    
    Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
      try {
        let fieldType = prop['x-type'] || prop.type || 'text';
        
        if (prop.type === 'array' && prop.items?.enum) {
          fieldType = 'select_multiple';
        } else if (prop.type === 'string' && prop.enum) {
          fieldType = 'select_one';
        }

        let options: { label: string; value: string }[] | undefined;
        if (prop['x-options'] && Array.isArray(prop['x-options']) && prop['x-options'].length > 0) {
          options = prop['x-options'];
        } else if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
          options = prop.enum.map((val: string) => ({ label: val, value: val }));
        } else if (prop.items?.enum && Array.isArray(prop.items.enum) && prop.items.enum.length > 0) {
          options = prop.items.enum.map((val: string) => ({ label: val, value: val }));
        }

        const field: FormField = {
          name,
          label: prop.title || name,
          type: fieldType,
          required: schema.required?.includes(name) || false,
          group: prop['x-group'],
          dependsOn: prop['x-dependsOn'],
          dependsValue: prop['x-dependsValue'],
          options: options,
          noteText: prop['x-noteText'],
          validation: prop.minimum !== undefined || prop.maximum !== undefined ? {
            min: prop.minimum,
            max: prop.maximum,
          } : undefined,
          order: prop['x-order'] !== undefined ? prop['x-order'] : parsedFields.length,
        };
        
        parsedFields.push(field);
      } catch (error) {
        console.error(`Erreur lors du parsing du champ ${name}:`, error);
      }
    });
    
    const sortedFields = parsedFields.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      return orderA - orderB;
    });
    
    setFields(sortedFields);
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // PROTECTION CONTRE LES DOUBLES SOUMISSIONS
    // Vérifier si une soumission est déjà en cours
    if (submitting) {
      console.warn('⚠️ Tentative de double soumission bloquée');
      return;
    }
    
    // Valider les champs requis
    const missingFields = fields.filter(
      (field) => field.required && !formData[field.name]
    );
    
    if (missingFields.length > 0) {
      showAlert(
        'Champs obligatoires',
        `Veuillez remplir les champs suivants: ${missingFields.map(f => f.label).join(', ')}`,
        'warning'
      );
      return;
    }

    try {
      // Marquer immédiatement comme en cours de soumission pour éviter les doubles clics
      setSubmitting(true);
      
      console.log('📤 Soumission du formulaire...', { formId: params.id, dataKeys: Object.keys(formData) });
      
      const result = await formsApi.submitPublic(params.id as string, {
        data: formData,
      });
      
      console.log('✅ Formulaire soumis avec succès:', result);
      
      showAlert(
        'Succès',
        'Votre formulaire a été soumis avec succès. Merci pour votre participation.',
        'success'
      );
      
      // Réinitialiser le formulaire après 2 secondes
      setTimeout(() => {
        setFormData({});
        router.push('/');
      }, 2000);
    } catch (error: any) {
      console.error('❌ Erreur lors de la soumission:', error);
      
      // Vérifier si l'erreur indique un doublon (soumission déjà existante)
      const errorMessage = error.message || 'Erreur lors de la soumission du formulaire';
      const isDuplicateError = errorMessage.includes('Une soumission existe déjà') ||
                              errorMessage.includes('doublon') ||
                              errorMessage.includes('déjà') ||
                              error.status === 400 && errorMessage.includes('existe');
      
      // Vérifier si l'erreur indique que la soumission a quand même réussi
      // (par exemple, erreur de réseau mais données déjà enregistrées)
      const isNetworkError = error.code === 'ECONNABORTED' || 
                            error.message?.includes('timeout') ||
                            error.message?.includes('network') ||
                            (error.response?.status >= 500 && !isDuplicateError);
      
      if (isDuplicateError) {
        // Erreur de doublon - message spécifique
        showAlert(
          'Soumission déjà enregistrée', 
          errorMessage + '\n\nSi vous pensez qu\'il s\'agit d\'une erreur, veuillez contacter le support.',
          'warning'
        );
      } else if (isNetworkError) {
        showAlert(
          'Attention', 
          'Une erreur réseau s\'est produite. Votre formulaire a peut-être été soumis. Veuillez vérifier ou réessayer.',
          'warning'
        );
      } else {
        showAlert('Erreur', errorMessage, 'error');
      }
    } finally {
      // Toujours réinitialiser le flag de soumission
      setSubmitting(false);
    }
  };

  // Calculer les champs visibles selon les dépendances
  const getVisibleFields = () => {
    return fields.filter((field) => {
      if (!field.dependsOn) return true;
      const dependsOnValue = formData[field.dependsOn];
      return dependsOnValue === field.dependsValue;
    });
  };

  const visibleFields = getVisibleFields();

  // Grouper les champs par groupe
  const groupedFields: Record<string, FormField[]> = {};
  const ungroupedFields: FormField[] = [];

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

  // Trier les champs dans chaque groupe
  Object.keys(groupedFields).forEach((groupName) => {
    groupedFields[groupName].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : Infinity;
      const orderB = b.order !== undefined ? b.order : Infinity;
      return orderA - orderB;
    });
  });

  const renderField = (field: FormField) => {
    switch (field.type) {
      case 'select_one':
        return (
          <select
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
          >
            <option value="">Sélectionner...</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      
      case 'select_multiple':
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <label key={opt.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={(formData[field.name] || []).includes(opt.value)}
                  onChange={(e) => {
                    const current = formData[field.name] || [];
                    if (e.target.checked) {
                      handleChange(field.name, [...current, opt.value]);
                    } else {
                      handleChange(field.name, current.filter((v: string) => v !== opt.value));
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-gray-900">{opt.label}</span>
              </label>
            ))}
          </div>
        );
      
      case 'text':
        return (
          <input
            type="text"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
            placeholder={field.label}
          />
        );
      
      case 'integer':
        return (
          <input
            type="number"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, parseInt(e.target.value) || '')}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );
      
      case 'decimal':
        return (
          <input
            type="number"
            step="0.01"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, parseFloat(e.target.value) || '')}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );
      
      case 'date':
        return (
          <input
            type="date"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
          />
        );
      
      case 'time':
        return (
          <input
            type="time"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
          />
        );
      
      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
          />
        );
      
      case 'note':
        return (
          <div className="border rounded-md px-3 py-2 bg-gray-50">
            <p className="text-gray-900 whitespace-pre-wrap">
              {field.noteText || 'Texte de la note'}
            </p>
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-gray-900 bg-white"
            required={field.required}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement du formulaire...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Formulaire non trouvé</h1>
          <p className="text-gray-600">Ce formulaire n'existe pas ou n'est pas publié.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{form.name}</h1>
          {form.description && (
            <p className="mt-2 text-sm text-gray-600">{form.description}</p>
          )}
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="bg-white rounded-lg shadow p-6 space-y-6"
          onKeyDown={(e) => {
            // Empêcher la soumission multiple via Enter si déjà en cours
            if (e.key === 'Enter' && submitting) {
              e.preventDefault();
            }
          }}
        >
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
          {Object.entries(groupedFields).map(([groupName, groupFields]) => (
            <div key={groupName} className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-blue-300">
                {groupName}
              </h3>
              <div className="space-y-4">
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
          ))}

          {fields.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Aucune question dans ce formulaire.
            </div>
          )}

          {fields.length > 0 && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Envoi en cours...' : 'Soumettre'}
              </button>
            </div>
          )}
        </form>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}

