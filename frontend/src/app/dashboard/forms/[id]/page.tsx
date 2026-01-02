'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../../store/authStore';
import { formsApi } from '../../../../lib/api/forms';
import { Form, FormVersion } from '../../../../types';

export default function FormEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<any>({
    type: 'object',
    properties: {},
    required: [],
  });
  const [showVersionModal, setShowVersionModal] = useState(false);

  const loadForm = useCallback(async () => {
    try {
      const data = await formsApi.getById(params.id as string);
      setForm(data);
      const latestVersion = data.versions?.[data.versions.length - 1];
      if (latestVersion) {
        setSchema(latestVersion.schema);
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (user?.role === 'SUPERADMIN' && params.id) {
      loadForm();
    }
  }, [params.id, user, loadForm]);

  const handleAddField = () => {
    const fieldName = prompt('Nom du champ (ex: nom, prenom, telephone):');
    if (!fieldName) return;

    const fieldType = prompt('Type (text, number, date, select, gps, photo, signature):');
    if (!fieldType) return;

    const newSchema = {
      ...schema,
      properties: {
        ...schema.properties,
        [fieldName]: {
          type: fieldType === 'number' ? 'number' : 'string',
          title: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
          ...(fieldType === 'select' && {
            enum: [],
            enumNames: [],
          }),
          ...(fieldType === 'gps' && {
            format: 'gps',
          }),
          ...(fieldType === 'photo' && {
            format: 'photo',
          }),
          ...(fieldType === 'signature' && {
            format: 'signature',
          }),
        },
      },
    };
    setSchema(newSchema);
  };

  const handleSaveVersion = async () => {
    try {
      await formsApi.createVersion(params.id as string, {
        schema,
        isPublished: false,
      });
      alert('Version sauvegardée avec succès!');
      loadForm();
      setShowVersionModal(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handlePublishVersion = async (version: number) => {
    if (!confirm(`Publier la version ${version} ?`)) return;
    try {
      await formsApi.publishVersion(params.id as string, version);
      alert('Version publiée avec succès!');
      loadForm();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la publication');
    }
  };

  if (user?.role !== 'SUPERADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!form) {
    return <div className="text-center py-12">Formulaire non trouvé</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{form.name}</h1>
        <p className="mt-2 text-sm text-gray-600">{form.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Éditeur de formulaire</h2>
              <button
                onClick={handleAddField}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                + Ajouter un champ
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(schema.properties || {}).map(([key, value]: [string, any]) => (
                <div
                  key={key}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{value.title || key}</h3>
                      <p className="text-sm text-gray-500">
                        Type: {value.type}
                        {value.format && ` • Format: ${value.format}`}
                      </p>
                      {value.enum && (
                        <p className="text-xs text-gray-400 mt-1">
                          Options: {value.enum.join(', ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const newSchema = { ...schema };
                        delete newSchema.properties[key];
                        if (newSchema.required?.includes(key)) {
                          newSchema.required = newSchema.required.filter(
                            (r: string) => r !== key
                          );
                        }
                        setSchema(newSchema);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="mt-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={schema.required?.includes(key) || false}
                        onChange={(e) => {
                          const newSchema = { ...schema };
                          if (!newSchema.required) {
                            newSchema.required = [];
                          }
                          if (e.target.checked) {
                            if (!newSchema.required.includes(key)) {
                              newSchema.required.push(key);
                            }
                          } else {
                            newSchema.required = newSchema.required.filter(
                              (r: string) => r !== key
                            );
                          }
                          setSchema(newSchema);
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600">Champ obligatoire</span>
                    </label>
                  </div>
                </div>
              ))}
              {Object.keys(schema.properties || {}).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Aucun champ. Cliquez sur "Ajouter un champ" pour commencer.
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowVersionModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sauvegarder une version
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Versions</h2>
            <div className="space-y-3">
              {form.versions?.map((version) => (
                <div
                  key={version.id}
                  className="border border-gray-200 rounded p-3"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Version {version.version}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(version.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {version.isPublished && (
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                          Publiée
                        </span>
                      )}
                      {!version.isPublished && (
                        <button
                          onClick={() => handlePublishVersion(version.version)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Publier
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showVersionModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowVersionModal(false)}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Sauvegarder une nouvelle version
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Une nouvelle version du formulaire sera créée avec le schéma actuel.
                </p>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="publish"
                    className="mr-2"
                  />
                  <label htmlFor="publish" className="text-sm text-gray-700">
                    Publier cette version immédiatement
                  </label>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleSaveVersion}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

