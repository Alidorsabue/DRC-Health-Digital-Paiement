'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { campaignsApi } from '../../../lib/api/campaigns';
import { formsApi } from '../../../lib/api/forms';
import { Campaign, CreateCampaignDto, Form, Role } from '../../../types';
import Link from 'next/link';

export default function CampaignsPage() {
  const { user } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CreateCampaignDto>({
    name: '',
    description: '',
    type: '',
    startDate: '',
    endDate: '',
    durationDays: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const [campaignsData, formsData] = await Promise.all([
        campaignsApi.getAll(),
        formsApi.getAll(),
      ]);
      setCampaigns(campaignsData);
      setForms(formsData);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await campaignsApi.create(formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        type: '',
        startDate: '',
        endDate: '',
        durationDays: 0,
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      type: campaign.type,
      startDate: campaign.startDate.split('T')[0], // Format YYYY-MM-DD
      endDate: campaign.endDate.split('T')[0],
      durationDays: campaign.durationDays,
      enregistrementFormId: campaign.enregistrementFormId,
      validationFormId: campaign.validationFormId,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    try {
      await campaignsApi.update(editingCampaign.id, formData);
      setShowEditModal(false);
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        type: '',
        startDate: '',
        endDate: '',
        durationDays: 0,
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette campagne ?')) {
      return;
    }
    try {
      await campaignsApi.delete(id);
      loadData();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campagnes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestion des campagnes de santé publique
          </p>
        </div>
        {(user?.role === Role.SUPERADMIN) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            + Créer une campagne
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {campaign.name}
                </h3>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    campaign.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {campaign.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2">{campaign.type}</p>
              {campaign.description && (
                <p className="text-sm text-gray-600 mb-4">
                  {campaign.description}
                </p>
              )}
              <div className="text-xs text-gray-500 space-y-1">
                <div>
                  Début: {new Date(campaign.startDate).toLocaleDateString()}
                </div>
                <div>
                  Fin: {new Date(campaign.endDate).toLocaleDateString()}
                </div>
                <div>Durée: {campaign.durationDays} jours</div>
              </div>
              {(user?.role === Role.SUPERADMIN) && (
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => handleEdit(campaign)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(campaign.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
                    Créer une campagne
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
                      <input
                        type="text"
                        required
                        placeholder="Polio, Rougeole, Fièvre jaune..."
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                      />
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Date de début
                        </label>
                        <input
                          type="date"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          value={formData.startDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              startDate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Date de fin
                        </label>
                        <input
                          type="date"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          value={formData.endDate}
                          onChange={(e) => {
                            const endDate = e.target.value;
                            const startDate = formData.startDate;
                            const durationDays = startDate
                              ? Math.ceil(
                                  (new Date(endDate).getTime() -
                                    new Date(startDate).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )
                              : 0;
                            setFormData({
                              ...formData,
                              endDate,
                              durationDays,
                            });
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Durée (jours)
                      </label>
                      <input
                        type="number"
                        required
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                        value={formData.durationDays}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Formulaire d'enregistrement
                      </label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.enregistrementFormId || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            enregistrementFormId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Aucun</option>
                        {forms
                          .filter((f) => f.type === 'enregistrement')
                          .map((form) => (
                            <option key={form.id} value={form.id}>
                              {form.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Formulaire de validation
                      </label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.validationFormId || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validationFormId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Aucun</option>
                        {forms
                          .filter((f) => f.type === 'validation')
                          .map((form) => (
                            <option key={form.id} value={form.id}>
                              {form.name}
                            </option>
                          ))}
                      </select>
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
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingCampaign && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowEditModal(false);
                setEditingCampaign(null);
              }}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdate}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Modifier la campagne
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
                      <input
                        type="text"
                        required
                        placeholder="Polio, Rougeole, Fièvre jaune..."
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                      />
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Date de début
                        </label>
                        <input
                          type="date"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          value={formData.startDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              startDate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Date de fin
                        </label>
                        <input
                          type="date"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          value={formData.endDate}
                          onChange={(e) => {
                            const endDate = e.target.value;
                            const startDate = formData.startDate;
                            const durationDays = startDate
                              ? Math.ceil(
                                  (new Date(endDate).getTime() -
                                    new Date(startDate).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )
                              : 0;
                            setFormData({
                              ...formData,
                              endDate,
                              durationDays,
                            });
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Durée (jours)
                      </label>
                      <input
                        type="number"
                        required
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                        value={formData.durationDays}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Formulaire d'enregistrement
                      </label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.enregistrementFormId || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            enregistrementFormId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Aucun</option>
                        {forms
                          .filter((f) => f.type === 'enregistrement')
                          .map((form) => (
                            <option key={form.id} value={form.id}>
                              {form.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Formulaire de validation
                      </label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.validationFormId || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            validationFormId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Aucun</option>
                        {forms
                          .filter((f) => f.type === 'validation')
                          .map((form) => (
                            <option key={form.id} value={form.id}>
                              {form.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingCampaign(null);
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Annuler
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

