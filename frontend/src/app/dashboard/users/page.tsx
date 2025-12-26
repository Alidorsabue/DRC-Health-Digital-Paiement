'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { usersApi } from '../../../lib/api/auth';
import { User, CreateUserDto, Role, GeographicScope } from '../../../types';
import Link from 'next/link';

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<CreateUserDto>({
    username: '',
    password: '',
    email: '',
    fullName: '',
    role: Role.IT,
    scope: GeographicScope.AIRE,
    provinceId: '',
    zoneId: '',
    aireId: '',
  });

  useEffect(() => {
    if (currentUser?.role === Role.SUPERADMIN) {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Nettoyer les champs vides avant l'envoi
      const cleanedData: CreateUserDto = {
        ...formData,
        provinceId: formData.provinceId || undefined,
        zoneId: formData.zoneId || undefined,
        aireId: formData.aireId || undefined,
      };
      
      await usersApi.create(cleanedData);
      setShowCreateModal(false);
      setFormData({
        username: '',
        password: '',
        email: '',
        fullName: '',
        role: Role.IT,
        scope: GeographicScope.AIRE,
        provinceId: '',
        zoneId: '',
        aireId: '',
      });
      loadUsers();
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Erreur lors de la création de l\'utilisateur';
      
      if (error.response?.status === 403) {
        alert(`Accès refusé (403): ${errorMessage}\n\nVérifiez que vous êtes connecté en tant que SuperAdmin et que votre session n'a pas expiré.`);
      } else if (error.response?.status === 401) {
        alert(`Non autorisé (401): Votre session a expiré. Veuillez vous reconnecter.`);
        // Rediriger vers la page de connexion
        window.location.href = '/login?expired=true';
      } else {
        alert(`Erreur: ${errorMessage}`);
      }
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', // Mot de passe vide pour l'édition (optionnel)
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      scope: user.scope,
      provinceId: user.provinceId || '',
      zoneId: user.zoneId || '',
      aireId: user.aireId || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      // Nettoyer les champs vides avant l'envoi
      const updateData: Partial<CreateUserDto> = {
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
        scope: formData.scope,
        provinceId: formData.provinceId || undefined,
        zoneId: formData.zoneId || undefined,
        aireId: formData.aireId || undefined,
      };

      // Inclure le mot de passe seulement s'il est rempli
      if (formData.password && formData.password.length > 0) {
        updateData.password = formData.password;
      }

      await usersApi.update(editingUser.id, updateData);
      setShowEditModal(false);
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        email: '',
        fullName: '',
        role: Role.IT,
        scope: GeographicScope.AIRE,
        provinceId: '',
        zoneId: '',
        aireId: '',
      });
      loadUsers();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Erreur lors de la mise à jour de l\'utilisateur';
      
      if (error.response?.status === 403) {
        alert(`Accès refusé (403): ${errorMessage}\n\nVérifiez que vous êtes connecté en tant que SuperAdmin et que votre session n'a pas expiré.`);
      } else if (error.response?.status === 401) {
        alert(`Non autorisé (401): Votre session a expiré. Veuillez vous reconnecter.`);
        window.location.href = '/login?expired=true';
      } else {
        alert(`Erreur: ${errorMessage}`);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }
    try {
      await usersApi.delete(id);
      loadUsers();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  if (currentUser?.role !== Role.SUPERADMIN) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestion des utilisateurs de la plateforme
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          + Créer un utilisateur
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((user) => (
            <li key={user.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {user.fullName.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {user.fullName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.username} • {user.email}
                    </div>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {user.scope}
                      </span>
                      {!user.isActive && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Inactif
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Editer
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
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
                    Créer un utilisateur
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nom d'utilisateur
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Mot de passe
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Rôle
                      </label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            role: e.target.value as Role,
                          })
                        }
                      >
                        {Object.values(Role).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Scope géographique
                      </label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.scope}
                        onChange={(e) => {
                          const newScope = e.target.value as GeographicScope;
                          setFormData({
                            ...formData,
                            scope: newScope,
                            // Réinitialiser les IDs géographiques quand le scope change
                            provinceId: newScope === GeographicScope.NATIONAL ? '' : formData.provinceId,
                            zoneId: newScope === GeographicScope.PROVINCE || newScope === GeographicScope.NATIONAL ? '' : formData.zoneId,
                            aireId: newScope !== GeographicScope.AIRE ? '' : formData.aireId,
                          });
                        }}
                      >
                        {Object.values(GeographicScope).map((scope) => (
                          <option key={scope} value={scope}>
                            {scope}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(formData.scope === GeographicScope.PROVINCE || 
                      formData.scope === GeographicScope.ZONE || 
                      formData.scope === GeographicScope.AIRE) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Province ID
                        </label>
                        <input
                          type="text"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Ex: Kinshasa, Kwilu"
                          value={formData.provinceId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, provinceId: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {(formData.scope === GeographicScope.ZONE || 
                      formData.scope === GeographicScope.AIRE) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Zone ID {formData.role === Role.MCZ && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          required={formData.role === Role.MCZ}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Ex: Mumbunda, Zone1"
                          value={formData.zoneId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, zoneId: e.target.value })
                          }
                        />
                        {formData.role === Role.MCZ && (
                          <p className="mt-1 text-xs text-gray-500">
                            Obligatoire pour les utilisateurs MCZ
                          </p>
                        )}
                      </div>
                    )}
                    {formData.scope === GeographicScope.AIRE && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Aire ID
                        </label>
                        <input
                          type="text"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Ex: Plateau 1, Aire1"
                          value={formData.aireId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, aireId: e.target.value })
                          }
                        />
                      </div>
                    )}
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

      {showEditModal && editingUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
              }}
            ></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdate}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Modifier l'utilisateur
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nom d'utilisateur
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Mot de passe <span className="text-gray-500 text-xs">(laisser vide pour ne pas changer)</span>
                      </label>
                      <input
                        type="password"
                        minLength={6}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        placeholder="Nouveau mot de passe (optionnel)"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Rôle
                      </label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            role: e.target.value as Role,
                          })
                        }
                      >
                        {Object.values(Role).map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Scope géographique
                      </label>
                      <select
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                        value={formData.scope}
                        onChange={(e) => {
                          const newScope = e.target.value as GeographicScope;
                          setFormData({
                            ...formData,
                            scope: newScope,
                            // Réinitialiser les IDs géographiques quand le scope change
                            provinceId: newScope === GeographicScope.NATIONAL ? '' : formData.provinceId,
                            zoneId: newScope === GeographicScope.PROVINCE || newScope === GeographicScope.NATIONAL ? '' : formData.zoneId,
                            aireId: newScope !== GeographicScope.AIRE ? '' : formData.aireId,
                          });
                        }}
                      >
                        {Object.values(GeographicScope).map((scope) => (
                          <option key={scope} value={scope}>
                            {scope}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(formData.scope === GeographicScope.PROVINCE || 
                      formData.scope === GeographicScope.ZONE || 
                      formData.scope === GeographicScope.AIRE) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Province ID
                        </label>
                        <input
                          type="text"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Ex: Kinshasa, Kwilu"
                          value={formData.provinceId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, provinceId: e.target.value })
                          }
                        />
                      </div>
                    )}
                    {(formData.scope === GeographicScope.ZONE || 
                      formData.scope === GeographicScope.AIRE) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Zone ID {formData.role === Role.MCZ && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          required={formData.role === Role.MCZ}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Ex: Mumbunda, Zone1"
                          value={formData.zoneId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, zoneId: e.target.value })
                          }
                        />
                        {formData.role === Role.MCZ && (
                          <p className="mt-1 text-xs text-gray-500">
                            Obligatoire pour les utilisateurs MCZ
                          </p>
                        )}
                      </div>
                    )}
                    {formData.scope === GeographicScope.AIRE && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Aire ID
                        </label>
                        <input
                          type="text"
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                          placeholder="Ex: Plateau 1, Aire1"
                          value={formData.aireId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, aireId: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
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

