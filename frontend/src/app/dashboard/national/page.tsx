'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { statsApi, NationalStats } from '../../../lib/api/stats';
import { prestatairesApi, Prestataire } from '../../../lib/api/prestataires';
import { geographicApi } from '../../../lib/api/geographic';
import { campaignsApi, Campaign } from '../../../lib/api/campaigns';
import DataTable, { Column } from '../../../components/DataTable';
import StatCardGroup, { StatCard } from '../../../components/Statistics/StatCardGroup';

interface GeographicOption {
  id: string;
  name: string;
}

export default function NationalPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NationalStats | null>(null);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [provinces, setProvinces] = useState<GeographicOption[]>([]);
  const [zones, setZones] = useState<GeographicOption[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    if (user?.role === 'NATIONAL' || user?.role === 'SUPERADMIN') {
      loadData();
      loadProvinces();
      loadCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedProvinceId) {
      loadZones();
    } else {
      setZones([]);
      setSelectedZoneId('');
    }
  }, [selectedProvinceId]);

  useEffect(() => {
    if (user?.role === 'NATIONAL' || user?.role === 'SUPERADMIN') {
      loadPrestataires();
    }
  }, [selectedProvinceId, selectedZoneId, selectedCampaignId, filterStatus, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedCampaignId) filters.campaignId = selectedCampaignId;
      
      const data = await statsApi.getNational(filters);
      setStats(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProvinces = async () => {
    try {
      const data = await statsApi.getProvincesFromData();
      setProvinces(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des provinces:', error);
    }
  };

  const loadZones = async () => {
    if (!selectedProvinceId) return;
    
    try {
      const data = await geographicApi.getZones(selectedProvinceId);
      setZones(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des zones:', error);
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await campaignsApi.getAll();
      setCampaigns(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des campagnes:', error);
    }
  };

  const loadPrestataires = async () => {
    try {
      const filters: any = {};
      if (selectedProvinceId) filters.provinceId = selectedProvinceId;
      if (selectedZoneId) filters.zoneId = selectedZoneId;
      if (selectedCampaignId) filters.campaignId = selectedCampaignId;
      if (filterStatus) filters.status = filterStatus;

      const data = await prestatairesApi.getAll(filters);
      setPrestataires(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des prestataires:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'ENREGISTRE': { label: 'Enregistré', color: 'bg-gray-100 text-gray-800' },
      'VALIDE_PAR_IT': { label: 'Validé par IT', color: 'bg-blue-100 text-blue-800' },
      'APPROUVE_PAR_MCZ': { label: 'Approuvé par MCZ', color: 'bg-green-100 text-green-800' },
      'REJETE_PAR_MCZ': { label: 'Rejeté par MCZ', color: 'bg-red-100 text-red-800' },
      'EN_ATTENTE_PAR_MCZ': { label: 'En attente MCZ', color: 'bg-yellow-100 text-yellow-800' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (prestataire: Prestataire) => {
    const status = prestataire.paymentStatus || 'PENDING';
    const statusMap: Record<string, { label: string; color: string }> = {
      'SENT': { label: 'Envoyé', color: 'bg-blue-100 text-blue-800' },
      'PAID': { label: 'Payé', color: 'bg-green-100 text-green-800' },
      'FAILED': { label: 'Échec', color: 'bg-red-100 text-red-800' },
      'PENDING': { label: 'En attente', color: 'bg-gray-100 text-gray-800' },
    };
    const statusInfo = statusMap[status] || statusMap['PENDING'];
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getKycStatusBadge = (prestataire: Prestataire) => {
    const kycStatus = prestataire.kycStatus || prestataire.kyc_status;
    if (!kycStatus) return <span className="text-gray-500 text-xs">Non vérifié</span>;
    
    const statusMap: Record<string, { label: string; color: string }> = {
      'CORRECT': { label: 'Correct', color: 'bg-green-100 text-green-800' },
      'INCORRECT': { label: 'Incorrect', color: 'bg-red-100 text-red-800' },
      'SANS_COMPTE': { label: 'Sans compte', color: 'bg-yellow-100 text-yellow-800' },
    };
    
    const statusInfo = statusMap[kycStatus] || { label: kycStatus, color: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (user?.role !== 'NATIONAL' && user?.role !== 'SUPERADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Interface National - Monitoring
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Vue d'ensemble de toutes les provinces (Lecture seule)
        </p>
      </div>

      {/* Statistiques nationales */}
      {stats && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-3xl">📊</span>
            Statistiques Nationales
          </h2>
          <StatCardGroup columns={5}>
            <StatCard
              title="Total Prestataires"
              value={stats.total || 0}
              icon="👥"
              color="indigo"
              progress={100}
            />
            <StatCard
              title="Enregistrés"
              value={stats.byStatus?.ENREGISTRE || 0}
              icon="📝"
              color="gray"
              progress={stats.total > 0 ? ((stats.byStatus?.ENREGISTRE || 0) / stats.total) * 100 : 0}
            />
            <StatCard
              title="Validés par IT"
              value={stats.byStatus?.VALIDE_PAR_IT || 0}
              icon="✅"
              color="blue"
              progress={stats.total > 0 ? ((stats.byStatus?.VALIDE_PAR_IT || 0) / stats.total) * 100 : 0}
            />
            <StatCard
              title="Approuvés par MCZ"
              value={stats.byStatus?.APPROUVE_PAR_MCZ || 0}
              icon="✓"
              color="green"
              progress={stats.total > 0 ? ((stats.byStatus?.APPROUVE_PAR_MCZ || 0) / stats.total) * 100 : 0}
            />
            <StatCard
              title="Rejetés par MCZ"
              value={stats.byStatus?.REJETE_PAR_MCZ || 0}
              icon="✗"
              color="red"
              progress={stats.total > 0 ? ((stats.byStatus?.REJETE_PAR_MCZ || 0) / stats.total) * 100 : 0}
            />
          </StatCardGroup>

          {/* Statistiques par province */}
          {stats.byProvince && Object.keys(stats.byProvince).length > 0 && (
            <div className="mt-8">
              <DataTable
                data={Object.entries(stats.byProvince).map(([provinceId, count]) => ({
                  id: provinceId,
                  province: provinceId,
                  total: count,
                  enregistres: count,
                  validesIt: '-',
                  approuvesMcz: '-',
                }))}
                columns={[
                  {
                    key: 'province',
                    label: 'Province',
                  },
                  {
                    key: 'total',
                    label: 'Total',
                  },
                  {
                    key: 'enregistres',
                    label: 'Enregistrés',
                  },
                  {
                    key: 'validesIt',
                    label: 'Validés IT',
                  },
                  {
                    key: 'approuvesMcz',
                    label: 'Approuvés MCZ',
                  },
                ]}
                title="Répartition par Province"
                exportFilename="statistiques-par-province"
              />
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Province
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedProvinceId}
              onChange={(e) => setSelectedProvinceId(e.target.value)}
            >
              <option value="">Toutes les provinces</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zone de Santé
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              disabled={!selectedProvinceId}
            >
              <option value="">Toutes les zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campagne
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">Toutes les campagnes</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="ENREGISTRE">Enregistré</option>
              <option value="VALIDE_PAR_IT">Validé par IT</option>
              <option value="APPROUVE_PAR_MCZ">Approuvé par MCZ</option>
              <option value="REJETE_PAR_MCZ">Rejeté par MCZ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des prestataires */}
      {prestataires.length === 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun prestataire trouvé</p>
          </div>
        </div>
      ) : (
        <DataTable
          data={prestataires}
          columns={[
            {
              key: 'id',
              label: 'ID',
            },
            {
              key: 'nom',
              label: 'Nom',
              render: (_, prestataire) => prestataire.nom || prestataire.nom_complet || 'N/A',
            },
            {
              key: 'provinceId',
              label: 'Province',
              render: (_, prestataire) => prestataire.provinceId || 'N/A',
            },
            {
              key: 'zoneId',
              label: 'Zone',
              render: (_, prestataire) => prestataire.zoneId || 'N/A',
            },
            {
              key: 'aireId',
              label: 'Aire',
              render: (_, prestataire) => prestataire.aireId || 'N/A',
            },
            {
              key: 'status',
              label: 'Statut',
              render: (_, prestataire) => getStatusBadge(prestataire.status || 'ENREGISTRE'),
            },
            {
              key: 'validationStatus',
              label: 'Statut Validation',
              render: (_, prestataire) => {
                const status = prestataire.status || 'ENREGISTRE';
                const statusMap: Record<string, { label: string; color: string }> = {
                  'ENREGISTRE': { label: 'Enregistré', color: 'bg-gray-100 text-gray-800' },
                  'VALIDE_PAR_IT': { label: 'Validé par IT', color: 'bg-blue-100 text-blue-800' },
                  'APPROUVE_PAR_MCZ': { label: 'Approuvé par MCZ', color: 'bg-green-100 text-green-800' },
                  'REJETE_PAR_MCZ': { label: 'Rejeté par MCZ', color: 'bg-red-100 text-red-800' },
                  'EN_ATTENTE_PAR_MCZ': { label: 'En attente MCZ', color: 'bg-yellow-100 text-yellow-800' },
                };
                const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
                return (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                );
              },
            },
            {
              key: 'validationDate',
              label: 'Date Validation IT',
              render: (_, prestataire) => {
                const rawData = prestataire.raw_data || {};
                const validationDate = prestataire.validationDate || 
                                      prestataire.validation_date || 
                                      rawData.validationDate || 
                                      rawData.validation_date ||
                                      rawData.validated_at ||
                                      prestataire.validated_at;
                
                if (!validationDate || validationDate === null || validationDate === undefined || validationDate === '') {
                  return <span className="text-gray-400 text-sm">N/A</span>;
                }
                
                try {
                  const date = new Date(validationDate);
                  if (!isNaN(date.getTime())) {
                    return (
                      <span className="text-sm text-gray-700">
                        {date.toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </span>
                    );
                  }
                } catch (e) {
                  console.warn('Erreur lors du formatage de la date:', e, validationDate);
                }
                
                return <span className="text-gray-400 text-sm">N/A</span>;
              },
            },
            {
              key: 'kycStatus',
              label: 'Statut KYC',
              render: (_, prestataire) => getKycStatusBadge(prestataire),
            },
            {
              key: 'paymentStatus',
              label: 'Statut Paiement',
              render: (_, prestataire) => getPaymentStatusBadge(prestataire),
            },
          ]}
          title="Prestataires"
          exportFilename="prestataires-national"
        />
      )}
    </div>
  );
}
