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
  console.log('🟢 [NationalPage] RENDER - Début du composant');
  const { user } = useAuthStore();
  const { t } = useTranslation();
  console.log('🟢 [NationalPage] RENDER - Hooks de base initialisés', { userId: user?.id, role: user?.role });
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
    console.log('🟢 [NationalPage] useEffect[initial] - Déclenché', { role: user?.role });
    if (user?.role === 'NATIONAL' || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') {
      console.log('🟢 [NationalPage] useEffect[initial] - Chargement des données');
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
    if (user?.role === 'NATIONAL' || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') {
      loadData();
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

  const formatDate = (dateValue: any): string => {
    if (!dateValue || dateValue === null || dateValue === undefined || dateValue === '') {
      return 'N/A';
    }
    
    try {
      let date: Date;
      if (typeof dateValue === 'string') {
        const trimmed = dateValue.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
          return 'N/A';
        }
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          const cleaned = dateValue.replace(/T/, ' ').replace(/Z$/, '').trim();
          date = new Date(cleaned);
        }
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        date = new Date(dateValue);
      }
      
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
      }
    } catch (e) {
      console.warn('Erreur lors du formatage de la date:', e, dateValue);
    }
    
    return 'N/A';
  };

  // Fonction helper pour récupérer validation_status (pas status qui contient l'approbation)
  const getValidationStatus = (prestataire: Prestataire): string => {
    const rawData = prestataire.raw_data || {};
    let validationStatus = (prestataire as any).validation_status ||
                          rawData.validation_status ||
                          (prestataire as any).validationStatus ||
                          rawData.validationStatus;
    
    // Si validation_status n'existe pas, vérifier s'il y a une date de validation (indique que validé par IT)
    if (!validationStatus || validationStatus === 'ENREGISTRE' || validationStatus === '') {
      const validationDate = (prestataire as any).validation_date ||
                            (prestataire as any).validationDate ||
                            (prestataire as any).validated_at ||
                            rawData.validation_date ||
                            rawData.validationDate ||
                            rawData.validated_at;
      
      // Si une date de validation existe, le prestataire a été validé par IT
      if (validationDate && validationDate !== '-' && validationDate !== null && validationDate !== '') {
        validationStatus = 'VALIDE_PAR_IT';
      } else {
        // Sinon, vérifier si status = APPROUVE_PAR_MCZ (signifie qu'il a d'abord été validé par IT)
        const status = prestataire.status || rawData.status;
        const statusStr = String(status || '').trim().toUpperCase();
        if (statusStr === 'APPROUVE_PAR_MCZ' || statusStr === 'APPROUVÉ_PAR_MCZ') {
          validationStatus = 'VALIDE_PAR_IT';
        } else if (!validationStatus) {
          validationStatus = 'ENREGISTRE';
        }
      }
    }
    
    return validationStatus;
  };

  const getValidationDate = (prestataire: Prestataire): string => {
    const rawData = prestataire.raw_data || {};
    const validationDate = prestataire.validationDate || 
                          prestataire.validation_date || 
                          rawData.validationDate || 
                          rawData.validation_date ||
                          rawData.validated_at ||
                          prestataire.validated_at;
    return formatDate(validationDate);
  };

  const getApprovalDate = (prestataire: Prestataire): string => {
    const rawData = prestataire.raw_data || {};
    const approvalDate = prestataire.approvalDate || 
                         prestataire.approval_date || 
                         rawData.approvalDate || 
                         rawData.approval_date ||
                         rawData.approved_at ||
                         prestataire.approved_at;
    return formatDate(approvalDate);
  };

  // Fonction helper pour récupérer le statut d'approbation
  // IMPORTANT: Utiliser approval_status (ou approvalStatus) et non status pour le statut d'approbation
  // Si le prestataire est validé par IT mais pas encore approuvé par MCZ, retourner "EN_ATTENTE"
  const getApprovalStatus = (prestataire: Prestataire): string => {
    const rawData = prestataire.raw_data || {};
    // Récupérer approval_status depuis les colonnes directes (pas depuis status)
    const approvalStatus = (prestataire as any).approval_status ||
                          (prestataire as any).approvalStatus ||
                          rawData.approval_status ||
                          rawData.approvalStatus;
    
    // Si un statut d'approbation existe, le retourner
    if (approvalStatus && approvalStatus !== null && approvalStatus !== '') {
      return approvalStatus;
    }
    
    // Si pas de statut d'approbation, vérifier si le prestataire est validé par IT
    const validationStatus = getValidationStatus(prestataire);
    // Si validé par IT mais pas encore approuvé, afficher "Validé par IT"
    if (validationStatus === 'VALIDE_PAR_IT') {
      return 'EN_ATTENTE_PAR_MCZ';
    }
    
    // Sinon, retourner "ENREGISTRE"
    return 'ENREGISTRE';
  };

  const getPaymentDate = (prestataire: Prestataire): string => {
    const rawData = prestataire.raw_data || {};
    const paymentDate = prestataire.paymentDate || 
                        prestataire.payment_date || 
                        rawData.paymentDate || 
                        rawData.payment_date ||
                        rawData.paid_at ||
                        prestataire.paid_at;
    return formatDate(paymentDate);
  };

  // Fonction helper pour récupérer le montant payé
  const getPaymentAmount = (prestataire: Prestataire): number => {
    const rawData = prestataire.raw_data || {};
    // Récupérer le montant et le convertir en nombre
    let amount: number = 0;
    
    // Essayer plusieurs sources et convertir en nombre
    const amountSources = [
      (prestataire as any).paymentAmount,
      (prestataire as any).payment_amount,
      rawData.paymentAmount,
      rawData.payment_amount,
    ];
    
    for (const source of amountSources) {
      if (source !== null && source !== undefined && source !== '') {
        if (typeof source === 'number') {
          amount = source;
          break;
        } else if (typeof source === 'string') {
          // Nettoyer la chaîne et convertir en nombre
          const cleaned = source.replace(/[$€FC\s,]/g, '').trim();
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed) && parsed > 0) {
            amount = parsed;
            break;
          }
        }
      }
    }
    
    return amount;
  };

  if (user?.role !== 'NATIONAL' && user?.role !== 'SUPERADMIN' && user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('errors.unauthorizedAccess')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('national.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-800">
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
              title={t('dashboard.paid')}
              value={stats.paid || 0}
              icon="💰"
              color="purple"
              progress={stats.total > 0 ? ((stats.paid || 0) / stats.total) * 100 : 0}
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
          {prestataires.length > 0 && (
            <div className="mt-8">
              <DataTable
                data={(() => {
                  // Calculer les statistiques par province depuis les prestataires
                  const provinceStats: Record<string, {
                    total: number;
                    validesIt: number;
                    approuvesMcz: number;
                    payes: number;
                  }> = {};

                  prestataires.forEach((p) => {
                    const provinceId = p.provinceId || 'N/A';
                    if (!provinceStats[provinceId]) {
                      provinceStats[provinceId] = {
                        total: 0,
                        validesIt: 0,
                        approuvesMcz: 0,
                        payes: 0,
                      };
                    }

                    provinceStats[provinceId].total++;

                    // Compter validés par IT
                    const validationStatus = getValidationStatus(p);
                    if (validationStatus === 'VALIDE_PAR_IT') {
                      provinceStats[provinceId].validesIt++;
                    }

                    // Compter approuvés par MCZ
                    const approvalStatus = getApprovalStatus(p);
                    if (approvalStatus === 'APPROUVE_PAR_MCZ') {
                      provinceStats[provinceId].approuvesMcz++;
                    }

                    // Compter payés
                    const paymentStatus = (p.paymentStatus || '').toUpperCase();
                    if (paymentStatus === 'PAID' || paymentStatus === 'PAYE' || paymentStatus === 'PAYÉ') {
                      provinceStats[provinceId].payes++;
                    }
                  });

                  return Object.entries(provinceStats).map(([provinceId, stats]) => ({
                    id: provinceId,
                    province: provinceId,
                    total: stats.total,
                    payes: stats.payes,
                    validesIt: stats.validesIt,
                    approuvesMcz: stats.approuvesMcz,
                  }));
                })()}
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
                    key: 'payes',
                    label: t('dashboard.paid'),
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
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
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
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
              key: 'provinceId',
              label: t('national.province'),
              filterType: 'select',
              render: (_, prestataire) => prestataire.provinceId || 'N/A',
            },
            {
              key: 'zoneId',
              label: t('national.zone'),
              filterType: 'select',
              render: (_, prestataire) => prestataire.zoneId || 'N/A',
            },
            {
              key: 'aireId',
              label: t('national.area'),
              filterType: 'select',
              render: (_, prestataire) => prestataire.aireId || 'N/A',
            },
            {
              key: 'nom',
              label: t('common.name'),
              render: (_, prestataire) => {
                const prenom = prestataire.prenom || prestataire.given_name_i_c || prestataire.Prenom || prestataire.Prénom || '';
                const nom = prestataire.nom || prestataire.family_name_i_c || prestataire.Nom || '';
                const postnom = prestataire.postnom || prestataire.middle_name_i_c || prestataire.Postnom || prestataire.post_nom || '';
                const rawData = prestataire.raw_data || {};
                const prenomRaw = rawData.prenom || rawData.given_name_i_c || rawData.Prenom || rawData.Prénom || '';
                const nomRaw = rawData.nom || rawData.family_name_i_c || rawData.Nom || '';
                const postnomRaw = rawData.postnom || rawData.middle_name_i_c || rawData.Postnom || rawData.post_nom || '';
                const finalPrenom = prenom || prenomRaw;
                const finalNom = nom || nomRaw;
                const finalPostnom = postnom || postnomRaw;
                const parts = [finalPrenom, finalNom, finalPostnom].filter(p => p && String(p).trim() && p !== 'null' && p !== 'undefined');
                return parts.length > 0 ? parts.join(' ') : (prestataire.nom_complet || prestataire.fullName || 'N/A');
              },
            },
            {
              key: 'gender',
              label: t('common.gender'),
              filterType: 'select',
              render: (_, prestataire) => {
                const rawData = prestataire.raw_data || {};
                const gender = (prestataire as any).gender_i_c ||
                              (prestataire as any).gender ||
                              (prestataire as any).sexe ||
                              rawData.gender_i_c ||
                              rawData.gender ||
                              rawData.sexe ||
                              'N/A';
                return gender;
              },
            },
            {
              key: 'telephone',
              label: t('common.phone'),
              render: (_, prestataire) => {
                const telephone = prestataire.telephone || prestataire.num_phone || prestataire.confirm_phone || prestataire.phone || '';
                const rawData = prestataire.raw_data || {};
                const telephoneRaw = rawData.telephone || rawData.num_phone || rawData.confirm_phone || rawData.phone || '';
                return telephone || telephoneRaw || 'N/A';
              },
            },
            {
              key: 'categorie',
              label: t('common.role'),
              filterType: 'select',
              render: (_, prestataire) => {
                const categorie = prestataire.categorie || prestataire.campaign_role_i_f || prestataire.campaign_role || prestataire.role || prestataire.role_prestataire || '';
                const rawData = prestataire.raw_data || {};
                const categorieRaw = rawData.categorie || rawData.campaign_role_i_f || rawData.campaign_role || rawData.role || rawData.role_prestataire || '';
                return categorie || categorieRaw || 'N/A';
              },
            },
            {
              key: 'kycStatus',
              label: t('partner.kycStatus'),
              render: (_, prestataire) => getKycStatusBadge(prestataire),
            },
            {
              key: 'validationStatus',
              label: t('partner.validationStatus'),
              render: (_, prestataire) => {
                const status = getValidationStatus(prestataire);
                let label = status;
                let color = 'bg-gray-100 text-gray-800';
                
                if (status === 'ENREGISTRE') {
                  label = t('status.registered');
                } else if (status === 'VALIDE_PAR_IT') {
                  label = t('status.validatedByIT');
                  color = 'bg-blue-100 text-blue-800';
                } else {
                  label = status;
                }
                
                return (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
                    {label}
                  </span>
                );
              },
            },
            {
              key: 'presenceDays',
              label: 'JOURS DE PRESENCE',
              sortable: true,
              render: (_, prestataire) => {
                const days = (prestataire as any).presenceDays || (prestataire as any).presence_days || (prestataire as any).presence || 0;
                return days || 'N/A';
              },
            },
            {
              key: 'validationDate',
              label: t('partner.validationDate'),
              render: (_, prestataire) => {
                const date = getValidationDate(prestataire);
                return (
                  <span className={`text-sm ${date !== 'N/A' ? 'text-gray-700' : 'text-gray-400'}`}>
                    {date}
                  </span>
                );
              },
            },
            {
              key: 'approvalStatus',
              label: t('partner.approvalStatus'),
              render: (_, prestataire) => {
                const approvalStatus = getApprovalStatus(prestataire);
                return getStatusBadge(approvalStatus);
              },
            },
            {
              key: 'approvalDate',
              label: t('partner.approvalDate'),
              render: (_, prestataire) => {
                const date = getApprovalDate(prestataire);
                return (
                  <span className={`text-sm ${date !== 'N/A' ? 'text-gray-700' : 'text-gray-400'}`}>
                    {date}
                  </span>
                );
              },
            },
            {
              key: 'paymentStatus',
              label: t('partner.paymentStatus'),
              render: (_, prestataire) => getPaymentStatusBadge(prestataire),
            },
            {
              key: 'paymentAmount',
              label: t('common.paidAmount'),
              render: (_, prestataire) => {
                const amount = getPaymentAmount(prestataire);
                if (amount <= 0) return 'N/A';
                const rawData = prestataire.raw_data || {};
                const currency = (prestataire as any).paymentCurrency || rawData.paymentCurrency || 'USD';
                let currencySymbol = '$';
                if (currency === 'CDF') {
                  currencySymbol = 'FC';
                } else if (currency === 'EURO') {
                  currencySymbol = '€';
                }
                return `${amount} ${currencySymbol}`;
              },
            },
            {
              key: 'paymentDate',
              label: t('partner.paymentDate'),
              render: (_, prestataire) => {
                const date = getPaymentDate(prestataire);
                return (
                  <span className={`text-sm ${date !== 'N/A' ? 'text-gray-700' : 'text-gray-400'}`}>
                    {date}
                  </span>
                );
              },
            },
          ]}
          title={t('national.providers')}
          exportFilename="prestataires-national"
        />
      )}
    </div>
  );
}

