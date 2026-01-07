'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { formsApi } from '../../../lib/api/forms';
import { Form, CreateFormDto, Role } from '../../../types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AlertModal from '../../../components/Modal/AlertModal';
import ConfirmModal from '../../../components/Modal/ConfirmModal';
import { getErrorMessage } from '../../../utils/error-handler';
import { useTranslation } from '../../../hooks/useTranslation';

function FormsPageContent() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
      const [forms, setForms] = useState<Form[]>([]);
      const [loading, setLoading] = useState(true);
      const [mounted, setMounted] = useState(false);
      const [activeTab, setActiveTab] = useState<'draft' | 'published'>(
        (searchParams.get('tab') as 'draft' | 'published') || 'draft'
      );
      const [prestatairesCounts, setPrestatairesCounts] = useState<Record<string, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMethodSelection, setShowMethodSelection] = useState(false);
  const [formData, setFormData] = useState<CreateFormDto>({
    name: '',
    description: '',
    type: 'enregistrement',
  });

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

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  // Utiliser directement la fonction sans mémorisation pour éviter les boucles infinies
  const loadForms = async () => {
    try {
      setLoading(true);
      console.log('DEBUG FORMS: Début du chargement des formulaires...');
      console.log('DEBUG FORMS: User role:', user?.role);
      console.log('DEBUG FORMS: Mounted:', mounted);
      
      const data = await formsApi.getAll();
      console.log('DEBUG FORMS: Réponse API reçue:', {
        count: data.length,
        data: data,
      });
      
      console.log('DEBUG FORMS: Forms loaded:', data.length);
      console.log('DEBUG FORMS: Forms with versions:', data.map(f => ({
        id: f.id,
        name: f.name,
        versionsCount: f.versions?.length || 0,
        publishedVersions: f.versions?.filter(v => v.isPublished).length || 0,
        hasPublished: f.versions?.some(v => v.isPublished) || false,
        versions: f.versions?.map(v => ({
          version: v.version,
          isPublished: v.isPublished,
        })),
      })));
      
      setForms(data);
      
      if (data.length === 0) {
        console.warn('DEBUG FORMS: Aucun formulaire trouvé dans la réponse API');
      }
    } catch (error: any) {
      console.error('DEBUG FORMS: Erreur lors du chargement des formulaires:', error);
      console.error('DEBUG FORMS: Détails de l\'erreur:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });
      
      // Afficher l'erreur à l'utilisateur avec message formaté et solutions
      const errorMsg = getErrorMessage(error, 'Erreur inconnue');
      showAlert(
        'Erreur',
        `Impossible de charger les formulaires:\n\n${errorMsg}`,
        'error'
      );
      
      // Mettre les formulaires à vide en cas d'erreur
      setForms([]);
    } finally {
      setLoading(false);
      console.log('DEBUG FORMS: Chargement terminé');
    }
  };

  // Utiliser un ref pour éviter les appels multiples
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const lastUserRoleRef = useRef<string | undefined>(undefined);
  const lastMountedRef = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const currentUserRole = user?.role;
    const shouldLoad = (currentUserRole === 'SUPERADMIN' || currentUserRole === 'ADMIN') && mounted;
    const userRoleChanged = lastUserRoleRef.current !== currentUserRole;
    const mountedChanged = lastMountedRef.current !== mounted;
    
    console.log('DEBUG FORMS: useEffect [user?.role, mounted] déclenché', {
      userRole: currentUserRole,
      mounted,
      shouldLoad,
      hasLoaded: hasLoadedRef.current,
      isLoading: isLoadingRef.current,
      userRoleChanged,
      mountedChanged,
    });

    // Ne charger que si :
    // 1. Les conditions sont remplies (SUPERADMIN et mounted)
    // 2. ET on n'est pas déjà en train de charger
    // 3. ET (on n'a jamais chargé OU le rôle a changé OU mounted est devenu true)
    const shouldTriggerLoad = shouldLoad && 
                              !isLoadingRef.current && 
                              (!hasLoadedRef.current || userRoleChanged || (mountedChanged && mounted));

    if (shouldTriggerLoad) {
      console.log('DEBUG FORMS: Chargement des formulaires...');
      isLoadingRef.current = true;
      hasLoadedRef.current = true;
      lastUserRoleRef.current = currentUserRole;
      lastMountedRef.current = mounted;
      
      loadForms().finally(() => {
        isLoadingRef.current = false;
      });
    } else {
      console.warn('DEBUG FORMS: Conditions non remplies ou déjà chargé:', {
        isSuperAdmin: currentUserRole === 'SUPERADMIN',
        isMounted: mounted,
        hasLoaded: hasLoadedRef.current,
        isLoading: isLoadingRef.current,
        userRoleChanged,
        mountedChanged,
        shouldTriggerLoad,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, mounted]); // Ne pas inclure forms.length pour éviter les boucles

  // Mettre à jour l'onglet actif selon les paramètres de l'URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'published' || tab === 'draft') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Recharger les formulaires quand on change d'onglet ou quand on arrive sur la page avec un paramètre tab
  useEffect(() => {
    console.log('DEBUG FORMS: useEffect [activeTab] déclenché', {
      activeTab,
      userRole: user?.role,
      mounted,
    });
    // Ne pas recharger si on change juste d'onglet, les données sont déjà chargées
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Ne pas inclure user et mounted pour éviter les re-renders inutiles

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newForm = await formsApi.create(formData);
      setShowCreateModal(false);
      setShowMethodSelection(false);
      setFormData({ name: '', description: '', type: 'enregistrement' });
      // Rediriger vers le Forms Builder
      router.push(`/dashboard/forms/${newForm.id}/builder`);
    } catch (error: any) {
      showAlert(t('common.error'), error.response?.data?.message || t('errors.errorCreating'), 'error');
    }
  };

  const [showXlsFormModal, setShowXlsFormModal] = useState(false);
  const [xlsFormFile, setXlsFormFile] = useState<File | null>(null);
  const [xlsFormUrl, setXlsFormUrl] = useState<string>('');
  const [xlsFormMethod, setXlsFormMethod] = useState<'file' | 'url'>('file');
  const [xlsFormType, setXlsFormType] = useState<'enregistrement' | 'validation'>('enregistrement');
  const [xlsFormTitle, setXlsFormTitle] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const handleMethodSelection = (method: 'builder' | 'xlsform') => {
    if (method === 'builder') {
      setShowMethodSelection(false);
      setShowCreateModal(true);
    } else {
      setShowMethodSelection(false);
      setShowXlsFormModal(true);
    }
  };

  const handleXlsFormImport = async (e: React.FormEvent) => {
    e.preventDefault();
    let fileToProcess: File | null = xlsFormFile;

    // Si import depuis URL
    if (xlsFormMethod === 'url') {
      if (!xlsFormUrl || !xlsFormUrl.trim()) {
        showAlert(t('common.error'), 'Veuillez saisir une URL', 'error');
        return;
      }

      setImporting(true);
      try {
        // Télécharger le fichier depuis l'URL
        const response = await fetch(xlsFormUrl);
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const urlParts = xlsFormUrl.split('/');
        const fileName = urlParts[urlParts.length - 1] || 'imported-form.xlsx';
        
        // Créer un File à partir du Blob
        fileToProcess = new File([blob], fileName, { type: blob.type });
      } catch (error: any) {
        console.error('Erreur lors du téléchargement depuis l\'URL:', error);
        showAlert(t('common.error'), `Erreur lors du téléchargement: ${error.message}`, 'error');
        setImporting(false);
        return;
      }
    } else {
      // Import depuis fichier local
      if (!xlsFormFile) {
        showAlert(t('common.error'), t('errors.selectFile'), 'error');
        return;
      }
      fileToProcess = xlsFormFile;
    }

    setImporting(true);
    try {
      const result = await formsApi.importXlsForm(fileToProcess, xlsFormType, xlsFormTitle || undefined);
      showAlert('Succès', result.message, 'success');
      setShowXlsFormModal(false);
      setXlsFormFile(null);
      setXlsFormUrl('');
      setXlsFormMethod('file');
      setXlsFormType('enregistrement');
      setXlsFormTitle('');
      // Recharger les formulaires
      await loadForms();
      // Rediriger vers le builder pour éditer si nécessaire
      router.push(`/dashboard/forms/${result.form.id}/builder`);
    } catch (error: any) {
      showAlert(
        t('common.error'),
        error.response?.data?.message || t('errors.errorImporting'),
        'error'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteForm = (form: Form) => {
    showConfirm(
      t('forms.deleteFormTitle'),
      t('forms.confirmDeleteFormMessageWithName').replace('{name}', form.name),
      async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await formsApi.delete(form.id);
          showAlert(t('common.success'), t('success.formDeleted'), 'success');
          loadForms(); // Recharger la liste
        } catch (error: any) {
          showAlert(t('common.error'), error.response?.data?.message || t('errors.errorDeleting'), 'error');
        }
      },
      'danger'
    );
  };

  if (user?.role !== 'SUPERADMIN' && user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('errors.unauthorizedAccess')}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  // Filtrer les formulaires selon l'onglet actif
  const publishedForms = forms.filter((form) => {
    const hasPublished = form.versions?.some((v) => v.isPublished) || false;
    return hasPublished;
  });

  const draftForms = forms.filter((form) => {
    const hasPublished = form.versions?.some((v) => v.isPublished) || false;
    const hasNoVersions = !form.versions || form.versions.length === 0;
    return !hasPublished || hasNoVersions;
  });

  const displayedForms = activeTab === 'published' ? publishedForms : draftForms;

  // Logs de débogage pour le filtrage
  console.log('DEBUG FORMS: Filtrage des formulaires:', {
    totalForms: forms.length,
    activeTab,
    publishedForms: publishedForms.length,
    draftForms: draftForms.length,
    displayedForms: displayedForms.length,
  });

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Formulaires</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestion des formulaires dynamiques
          </p>
        </div>
        {user?.role === Role.SUPERADMIN && (
          <button
            onClick={() => setShowMethodSelection(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            + Créer un formulaire
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('draft')}
            className={`${
              activeTab === 'draft'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Brouillons ({draftForms.length})
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={`${
              activeTab === 'published'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Publiés ({publishedForms.length})
          </button>
        </nav>
      </div>

      {/* Liste des formulaires */}
      {displayedForms.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 text-lg mb-2">
            {activeTab === 'published'
              ? 'Aucun formulaire publié'
              : 'Aucun brouillon'}
          </p>
          {forms.length > 0 && (
            <p className="text-sm text-gray-400">
              {forms.length} formulaire(s) au total, mais aucun ne correspond à cet onglet
            </p>
          )}
          {forms.length === 0 && !loading && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-4">
                Aucun formulaire n'a été trouvé. Créez votre premier formulaire en cliquant sur le bouton ci-dessus.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedForms.map((form) => {
            const publishedVersion = form.versions?.find((v) => v.isPublished);
            const latestVersion = form.versions?.sort((a, b) => b.version - a.version)[0];
            const createdBy = (form as any).createdBy;
            
            return (
              <div
                key={form.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {form.name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs rounded font-medium ${
                            form.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {form.isActive ? 'Actif' : 'Inactif'}
                        </span>
                        {publishedVersion && (
                          <>
                            <span className="px-2 py-1 text-xs rounded font-medium bg-blue-100 text-blue-800">
                              Publié v{publishedVersion.version}
                            </span>
                            {publishedVersion.isSentToMobile && (
                              <span className="px-2 py-1 text-xs rounded font-medium bg-green-100 text-green-800">
                                📱 Envoyé
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {form.description && (
                        <p className="text-sm text-gray-600 mb-4">
                          {form.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Informations détaillées */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500 font-medium">Type:</span>
                      <span className="ml-2 text-gray-900">{form.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Versions:</span>
                      <span className="ml-2 text-gray-900">{form.versions?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium">Créé le:</span>
                      <span className="ml-2 text-gray-900">
                        {mounted
                          ? new Date(form.createdAt).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : new Date(form.createdAt).toISOString().split('T')[0]}
                      </span>
                    </div>
                    {createdBy && (
                      <div>
                        <span className="text-gray-500 font-medium">Créé par:</span>
                        <span className="ml-2 text-gray-900">
                          {createdBy.fullName || createdBy.username || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>

                  {latestVersion && (
                    <div className="mb-4 text-sm">
                      <span className="text-gray-500 font-medium">Dernière version:</span>
                      <span className="ml-2 text-gray-900">
                        v{latestVersion.version} -{' '}
                        {mounted
                          ? new Date(latestVersion.createdAt).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : new Date(latestVersion.createdAt).toISOString().split('T')[0]}
                        {latestVersion.isPublished && (
                          <span className="ml-2 text-green-600 font-medium">(Publiée)</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-4">
                      {user?.role === Role.SUPERADMIN && (
                        <Link
                          href={`/dashboard/forms/${form.id}/builder`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                        >
                          <span>✏️</span>
                          <span>Éditer</span>
                        </Link>
                      )}
                      {publishedVersion && (
                        <>
                          <Link
                            href={`/dashboard/forms/${form.id}/data`}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1"
                          >
                            <span>📊</span>
                            <span>Data</span>
                            {prestatairesCounts[form.id] !== undefined && (
                              <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                                {prestatairesCounts[form.id]}
                              </span>
                            )}
                          </Link>
                          <Link
                            href={`/dashboard/forms/${form.id}/preview`}
                            className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1"
                          >
                            <span>👁️</span>
                            <span>{t('forms.view')}</span>
                          </Link>
                          {user?.role === Role.SUPERADMIN && (
                            <button
                              onClick={() => {
                                const publicUrl = `${window.location.origin}/forms/public/${form.id}`;
                                navigator.clipboard.writeText(publicUrl);
                                showAlert(t('common.success'), `${t('success.linkCopied')}:\n${publicUrl}`, 'success');
                              }}
                              className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                              title={t('forms.copyLinkTitle')}
                            >
                              <span>🔗</span>
                              <span>{t('forms.copyLink')}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {user?.role === Role.SUPERADMIN && (
                      <button
                        onClick={() => handleDeleteForm(form)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                        title={t('forms.deleteFormTitle')}
                      >
                        <span>🗑️</span>
                        <span>{t('forms.deleteForm')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showMethodSelection && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowMethodSelection(false)}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Choisir une méthode de création
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleMethodSelection('builder')}
                    className="p-6 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="text-3xl mb-2">🔧</div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {t('forms.formsBuilder')}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('forms.formsBuilderDescription')}
                    </p>
                  </button>
                  <button
                    onClick={() => handleMethodSelection('xlsform')}
                    className="p-6 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="text-3xl mb-2">📊</div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {t('forms.xlsForm')}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('forms.xlsFormDescription')}
                    </p>
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMethodSelection(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowCreateModal(false)}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreate}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Créer un formulaire
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nom
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Type
                      </label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                      >
                        <option value="enregistrement">Enregistrement</option>
                        <option value="validation">Validation</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        rows={3}
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
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

      {/* Modale d'import XlsForm */}
      {showXlsFormModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowXlsFormModal(false)}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleXlsFormImport}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Importer un formulaire XlsForm
                  </h3>
                  <div className="space-y-4">
                    {/* Sélection de la méthode d'import */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Méthode d'import
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setXlsFormMethod('file');
                            setXlsFormUrl('');
                          }}
                          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                            xlsFormMethod === 'file'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          📁 Fichier local
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setXlsFormMethod('url');
                            setXlsFormFile(null);
                          }}
                          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                            xlsFormMethod === 'url'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          🔗 URL / API
                        </button>
                      </div>
                    </div>

                    {/* Import depuis fichier */}
                    {xlsFormMethod === 'file' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fichier Excel (.xlsx ou .xls)
                        </label>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          required={xlsFormMethod === 'file'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setXlsFormFile(file);
                            }
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {xlsFormFile && (
                          <p className="mt-2 text-sm text-gray-600">
                            Fichier sélectionné: {xlsFormFile.name}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Import depuis URL */}
                    {xlsFormMethod === 'url' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          URL de l'API ou lien du fichier
                        </label>
                        <input
                          type="url"
                          value={xlsFormUrl}
                          onChange={(e) => setXlsFormUrl(e.target.value)}
                          placeholder="https://example.com/api/form.xlsx ou https://api.example.com/form"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={importing}
                          required={xlsFormMethod === 'url'}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          L'URL doit pointer vers un fichier Excel (.xlsx ou .xls) accessible publiquement
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Titre du formulaire
                      </label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        placeholder={t('forms.titleExtractedFromFile')}
                        value={xlsFormTitle}
                        onChange={(e) => setXlsFormTitle(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Optionnel : Si laissé vide, le titre sera extrait de la feuille "settings" du fichier Excel
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Type de formulaire
                      </label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={xlsFormType}
                        onChange={(e) =>
                          setXlsFormType(e.target.value as 'enregistrement' | 'validation')
                        }
                      >
                        <option value="enregistrement">Enregistrement</option>
                        <option value="validation">Validation</option>
                      </select>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm text-blue-800">
                        <strong>Format attendu:</strong> Le fichier doit contenir au minimum une
                        feuille "survey" avec les colonnes: type, name, label. Optionnellement, une
                        feuille "choices" pour les listes de sélection et une feuille "settings" pour
                        le titre du formulaire.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={importing || (xlsFormMethod === 'file' && !xlsFormFile) || (xlsFormMethod === 'url' && !xlsFormUrl.trim())}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {importing ? 'Import en cours...' : 'Importer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowXlsFormModal(false);
                      setXlsFormFile(null);
                      setXlsFormUrl('');
                      setXlsFormMethod('file');
                      setXlsFormTitle('');
                    }}
                    disabled={importing}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormsPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-12">
        <p className="text-gray-500">Chargement...</p>
      </div>
    }>
      <FormsPageContent />
    </Suspense>
  );
}

