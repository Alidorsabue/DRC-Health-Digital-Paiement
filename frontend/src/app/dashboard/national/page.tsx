'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { statsApi, NationalStats } from '../../../lib/api/stats';
import { prestatairesApi, Prestataire } from '../../../lib/api/prestataires';
import { geographicApi } from '../../../lib/api/geographic';
import { campaignsApi, Campaign } from '../../../lib/api/campaigns';
import DataTable, { Column } from '../../../components/DataTable';
import StatCardGroup, { StatCard } from '../../../components/Statistics/StatCardGroup';
import { useTranslation } from '../../../hooks/useTranslation';

interface GeographicOption {
  id: string;
  name: string;
}

export default function NationalPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
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
    let label = status;
    let color = 'bg-gray-100 text-gray-800';
    
    if (status === 'ENREGISTRE') {
      label = t('status.registered');
    } else if (status === 'VALIDE_PAR_IT') {
      label = t('status.validatedByIT');
      color = 'bg-blue-100 text-blue-800';
    } else if (status === 'APPROUVE_PAR_MCZ') {
      label = t('status.approvedByMCZ');
      color = 'bg-green-100 text-green-800';
    } else if (status === 'REJETE_PAR_MCZ') {
      label = t('status.rejectedByMCZ');
      color = 'bg-red-100 text-red-800';
    } else if (status === 'EN_ATTENTE_PAR_MCZ') {
      label = t('status.pendingMCZ');
      color = 'bg-yellow-100 text-yellow-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const getPaymentStatusBadge = (prestataire: Prestataire) => {
    const status = prestataire.paymentStatus || 'PENDING';
    const statusUpper = status.toUpperCase();
    let label = t('status.pending');
    let color = 'bg-gray-100 text-gray-800';
    
    if (statusUpper === 'SENT') {
      label = t('status.sent');
      color = 'bg-blue-100 text-blue-800';
    } else if (statusUpper === 'PAID' || statusUpper === 'PAYE' || statusUpper === 'PAYÉ') {
      label = t('status.paid');
      color = 'bg-green-100 text-green-800';
    } else if (statusUpper === 'FAILED' || statusUpper === 'ECHEC') {
      label = t('status.failed');
      color = 'bg-red-100 text-red-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const getKycStatusBadge = (prestataire: Prestataire) => {
    const kycStatus = prestataire.kycStatus || prestataire.kyc_status;
    if (!kycStatus) return <span className="text-gray-500 text-xs">{t('partner.notVerified')}</span>;
    
    let label = kycStatus;
    let color = 'bg-gray-100 text-gray-800';
    
    if (kycStatus === 'CORRECT') {
      label = t('partner.correct');
      color = 'bg-green-100 text-green-800';
    } else if (kycStatus === 'INCORRECT') {
      label = t('partner.incorrect');
      color = 'bg-red-100 text-red-800';
    } else if (kycStatus === 'SANS_COMPTE') {
      label = t('partner.noAccount');
      color = 'bg-yellow-100 text-yellow-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
        {label}
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
          {t('national.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('national.subtitle')}
        </p>
      </div>

      {/* Statistiques nationales */}
      {stats && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="text-3xl">📊</span>
            {t('dashboard.nationalStatistics')}
          </h2>
          <StatCardGroup columns={5}>
            <StatCard
              title={t('dashboard.totalProviders')}
              value={stats.total || 0}
              icon="👥"
              color="indigo"
              progress={100}
            />
            <StatCard
              title={t('dashboard.registered')}
              value={stats.byStatus?.ENREGISTRE || 0}
              icon="📝"
              color="gray"
              progress={stats.total > 0 ? ((stats.byStatus?.ENREGISTRE || 0) / stats.total) * 100 : 0}
            />
            <StatCard
              title={t('dashboard.validatedByIT')}
              value={stats.byStatus?.VALIDE_PAR_IT || 0}
              icon="✅"
              color="blue"
              progress={stats.total > 0 ? ((stats.byStatus?.VALIDE_PAR_IT || 0) / stats.total) * 100 : 0}
            />
            <StatCard
              title={t('dashboard.approvedByMCZ')}
              value={stats.byStatus?.APPROUVE_PAR_MCZ || 0}
              icon="✓"
              color="green"
              progress={stats.total > 0 ? ((stats.byStatus?.APPROUVE_PAR_MCZ || 0) / stats.total) * 100 : 0}
            />
            <StatCard
              title={t('dashboard.rejectedByMCZ')}
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
                    label: t('national.province'),
                  },
                  {
                    key: 'total',
                    label: t('dashboard.totalProviders'),
                  },
                  {
                    key: 'enregistres',
                    label: t('dashboard.registered'),
                  },
                  {
                    key: 'validesIt',
                    label: t('dashboard.validatedByIT'),
                  },
                  {
                    key: 'approuvesMcz',
                    label: t('dashboard.approvedByMCZ'),
                  },
                ]}
                title={t('national.provinceDistribution')}
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
              {t('common.province')}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedProvinceId}
              onChange={(e) => setSelectedProvinceId(e.target.value)}
            >
              <option value="">{t('national.allProvinces')}</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.zone')}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              disabled={!selectedProvinceId}
            >
              <option value="">{t('national.allZones')}</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.campaign')}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">{t('national.allCampaigns')}</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.status')}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">{t('national.allStatuses')}</option>
              <option value="ENREGISTRE">{t('status.registered')}</option>
              <option value="VALIDE_PAR_IT">{t('status.validatedByIT')}</option>
              <option value="APPROUVE_PAR_MCZ">{t('status.approvedByMCZ')}</option>
              <option value="REJETE_PAR_MCZ">{t('status.rejectedByMCZ')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des prestataires */}
      {prestataires.length === 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="text-center py-12">
            <p className="text-gray-500">{t('national.noProviders')}</p>
          </div>
        </div>
      ) : (
        <DataTable
          data={prestataires}
          columns={[
            {
              key: 'id',
              label: t('common.id'),
            },
            {
              key: 'nom',
              label: t('common.name'),
              render: (_, prestataire) => prestataire.nom || prestataire.nom_complet || 'N/A',
            },
            {
              key: 'provinceId',
              label: t('national.province'),
              render: (_, prestataire) => prestataire.provinceId || 'N/A',
            },
            {
              key: 'zoneId',
              label: t('national.zone'),
              render: (_, prestataire) => prestataire.zoneId || 'N/A',
            },
            {
              key: 'aireId',
              label: t('national.area'),
              render: (_, prestataire) => prestataire.aireId || 'N/A',
            },
            {
              key: 'status',
              label: t('common.status'),
              render: (_, prestataire) => getStatusBadge(prestataire.status || 'ENREGISTRE'),
            },
            {
              key: 'validationStatus',
              label: t('partner.validationStatus'),
              render: (_, prestataire) => {
                const status = prestataire.status || 'ENREGISTRE';
                let label = status;
                let color = 'bg-gray-100 text-gray-800';
                
                if (status === 'ENREGISTRE') {
                  label = t('status.registered');
                } else if (status === 'VALIDE_PAR_IT') {
                  label = t('status.validatedByIT');
                  color = 'bg-blue-100 text-blue-800';
                } else if (status === 'APPROUVE_PAR_MCZ') {
                  label = t('status.approvedByMCZ');
                  color = 'bg-green-100 text-green-800';
                } else if (status === 'REJETE_PAR_MCZ') {
                  label = t('status.rejectedByMCZ');
                  color = 'bg-red-100 text-red-800';
                } else if (status === 'EN_ATTENTE_PAR_MCZ') {
                  label = t('status.pendingMCZ');
                  color = 'bg-yellow-100 text-yellow-800';
                }
                
                return (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
                    {label}
                  </span>
                );
              },
            },
            {
              key: 'validationDate',
              label: t('partner.validationDate'),
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
              label: t('partner.kycStatus'),
              render: (_, prestataire) => getKycStatusBadge(prestataire),
            },
            {
              key: 'paymentStatus',
              label: t('partner.paymentStatus'),
              render: (_, prestataire) => getPaymentStatusBadge(prestataire),
            },
          ]}
          title={t('national.providers')}
          exportFilename="prestataires-national"
        />
      )}
    </div>
  );
}
