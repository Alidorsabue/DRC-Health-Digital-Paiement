'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { statsApi, ProvinceStats } from '../../../lib/api/stats';
import { prestatairesApi, Prestataire } from '../../../lib/api/prestataires';
import { geographicApi } from '../../../lib/api/geographic';
import { campaignsApi } from '../../../lib/api/campaigns';
import { formsApi } from '../../../lib/api/forms';
import { Campaign, Form } from '../../../types';
import DataTable, { Column } from '../../../components/DataTable';
import { getErrorMessage } from '../../../utils/error-handler';
import AlertModal from '../../../components/Modal/AlertModal';
import StatCardGroup, { StatCard } from '../../../components/Statistics/StatCardGroup';
import { useTranslation } from '../../../hooks/useTranslation';

interface GeographicOption {
  id: string;
  name: string;
}

export default function ProvincePage() {
  console.log('🟠 [ProvincePage] RENDER - Début du composant');
  const { user } = useAuthStore();
  console.log('🟠 [ProvincePage] RENDER - Hooks de base initialisés', { userId: user?.id, role: user?.role });
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadingPrestataires, setLoadingPrestataires] = useState(false);
  const [stats, setStats] = useState<ProvinceStats | null>(null);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [zones, setZones] = useState<GeographicOption[]>([]);
  const [aires, setAires] = useState<GeographicOption[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedAireId, setSelectedAireId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [alert, setAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlert({ title, message, type });
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadData = async () => {
    if (!user?.provinceId) return;
    
    setLoading(true);
    try {
      const data = await statsApi.getProvince(user.provinceId);
      setStats(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
      const errorMsg = getErrorMessage(error, t('errors.errorUnknown'));
      showAlert(t('common.error'), `${t('errors.errorLoadingProviders')}:\n\n${errorMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadZones = async () => {
    const provinceId = user?.provinceId;
    if (!provinceId) {
      console.warn('DEBUG PROVINCE: Pas de provinceId, impossible de charger les zones');
      setZones([]);
      return;
    }
    
    try {
      console.log('DEBUG PROVINCE: Chargement des zones pour province:', provinceId);
      // Récupérer les zones depuis l'API géographique
      const zonesFromGeo = await geographicApi.getZones(provinceId);
      console.log('DEBUG PROVINCE: Zones depuis API géographique:', zonesFromGeo.length, zonesFromGeo);
      
      // Récupérer les zones depuis les données (tables form_*)
      let zonesFromData: { id: string; name: string }[] = [];
      try {
        zonesFromData = await statsApi.getZonesFromData(provinceId);
        console.log('DEBUG PROVINCE: Zones depuis les données:', zonesFromData.length, zonesFromData);
      } catch (error) {
        console.warn('DEBUG PROVINCE: Impossible de récupérer les zones depuis les données:', error);
      }
      
      // Combiner et dédupliquer les zones
      const allZonesMap = new Map<string, { id: string; name: string }>();
      
      // Ajouter les zones de l'API géographique (elles ont les noms complets)
      zonesFromGeo.forEach(z => {
        allZonesMap.set(z.id, z);
      });
      
      // Ajouter les zones des données
      zonesFromData.forEach(z => {
        if (!allZonesMap.has(z.id)) {
          allZonesMap.set(z.id, { id: z.id, name: z.name || z.id });
        }
      });
      
      const allZones = Array.from(allZonesMap.values());
      console.log('DEBUG PROVINCE: Zones combinées:', allZones.length, allZones);
      setZones(allZones);
    } catch (error: any) {
      console.error('DEBUG PROVINCE: Erreur lors du chargement des zones:', error);
      console.error('DEBUG PROVINCE: Détails de l\'erreur:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setZones([]);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadCampaigns = async () => {
    try {
      const data = await campaignsApi.getAll();
      setCampaigns(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des campagnes:', error);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadAires = async (zoneId: string) => {
    if (!zoneId) {
      setAires([]);
      return;
    }
    
    try {
      console.log('DEBUG PROVINCE: Chargement des aires pour zone:', zoneId);
      // Récupérer les aires depuis l'API géographique
      const airesFromGeo = await geographicApi.getAires(zoneId);
      console.log('DEBUG PROVINCE: Aires depuis API géographique:', airesFromGeo.length, airesFromGeo);
      
      // Récupérer les aires depuis les données (tables form_*)
      let airesFromData: { id: string; name: string }[] = [];
      try {
        airesFromData = await statsApi.getAiresFromData(zoneId);
        console.log('DEBUG PROVINCE: Aires depuis les données:', airesFromData.length, airesFromData);
      } catch (error) {
        console.warn('DEBUG PROVINCE: Impossible de récupérer les aires depuis les données:', error);
      }
      
      // Combiner et dédupliquer les aires
      const allAiresMap = new Map<string, { id: string; name: string }>();
      
      // Ajouter les aires de l'API géographique (elles ont les noms complets)
      airesFromGeo.forEach(a => {
        allAiresMap.set(a.id, a);
      });
      
      // Ajouter les aires des données
      airesFromData.forEach(a => {
        if (!allAiresMap.has(a.id)) {
          allAiresMap.set(a.id, { id: a.id, name: a.name || a.id });
        }
      });
      
      const allAires = Array.from(allAiresMap.values());
      console.log('DEBUG PROVINCE: Aires combinées:', allAires.length, allAires);
      setAires(allAires);
    } catch (error: any) {
      console.error('DEBUG PROVINCE: Erreur lors du chargement des aires:', error);
      console.error('DEBUG PROVINCE: Détails de l\'erreur:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setAires([]);
    }
  };

  useEffect(() => {
    if (user?.role === 'DPS' && user?.provinceId) {
      console.log('DEBUG PROVINCE: useEffect initial déclenché pour DPS avec provinceId:', user.provinceId);
      loadData();
      loadZones();
      loadCampaigns();
    } else {
      console.log('DEBUG PROVINCE: useEffect initial - conditions non remplies', {
        role: user?.role,
        provinceId: user?.provinceId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.provinceId]);

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadPrestataires = async () => {
    const provinceId = user?.provinceId;
    if (!provinceId) {
      console.warn('DEBUG PROVINCE: Pas de provinceId, impossible de charger les prestataires');
      setPrestataires([]);
      return;
    }
    
    setLoadingPrestataires(true);
    try {
      console.log('DEBUG PROVINCE: Chargement des prestataires pour province:', provinceId);
      const filters: any = {
        provinceId: provinceId,
      };
      if (selectedZoneId) {
        filters.zoneId = selectedZoneId;
        console.log('DEBUG PROVINCE: Filtre zoneId ajouté:', selectedZoneId);
      }
      if (selectedAireId) {
        filters.aireId = selectedAireId;
        console.log('DEBUG PROVINCE: Filtre aireId ajouté:', selectedAireId);
      }
      if (selectedCampaignId) {
        filters.campaignId = selectedCampaignId;
        console.log('DEBUG PROVINCE: Filtre campaignId ajouté:', selectedCampaignId);
      }
      if (filterStatus) {
        filters.status = filterStatus;
        console.log('DEBUG PROVINCE: Filtre status ajouté:', filterStatus);
      }

      console.log('DEBUG PROVINCE: Filtres appliqués:', filters);
      console.log('DEBUG PROVINCE: Appel API avec URL:', `/prestataires?${new URLSearchParams(filters as any).toString()}`);
      
      const data = await prestatairesApi.getAll(filters);
      console.log('DEBUG PROVINCE: Prestataires reçus du backend:', data?.length || 0);
      console.log('DEBUG PROVINCE: Détails des prestataires:', data);
      
      if (data && Array.isArray(data)) {
        setPrestataires(data);
      } else {
        console.warn('DEBUG PROVINCE: Les données reçues ne sont pas un tableau:', data);
        setPrestataires([]);
      }
    } catch (error: any) {
      console.error('DEBUG PROVINCE: Erreur lors du chargement des prestataires:', error);
      const errorMsg = getErrorMessage(error, 'Erreur inconnue');
      showAlert(t('common.error'), `${t('errors.errorLoadingProviders')}:\n\n${errorMsg}`, 'error');
      setPrestataires([]);
    } finally {
      setLoadingPrestataires(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'DPS' && user?.provinceId) {
      console.log('DEBUG PROVINCE: useEffect prestataires déclenché', {
        selectedZoneId,
        selectedAireId,
        selectedCampaignId,
        filterStatus,
        provinceId: user.provinceId,
      });
      loadPrestataires();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.provinceId, selectedZoneId, selectedAireId, selectedCampaignId, filterStatus]);

  useEffect(() => {
    if (selectedZoneId) {
      loadAires(selectedZoneId);
      setSelectedAireId(''); // Réinitialiser le filtre aire quand la zone change
    } else {
      setAires([]);
      setSelectedAireId('');
    }
  }, [selectedZoneId]);

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
    // Si la valeur est null, undefined, ou vide, retourner 'N/A'
    if (!dateValue || dateValue === null || dateValue === undefined || dateValue === '') {
      return 'N/A';
    }
    
    try {
      let date: Date;
      if (typeof dateValue === 'string') {
        // Si c'est une chaîne vide ou 'null'/'undefined', retourner N/A
        const trimmed = dateValue.trim();
        if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
          return 'N/A';
        }
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          // Essayer de nettoyer la chaîne
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
    
    // Si on arrive ici, la valeur n'est pas une date valide, retourner N/A
    return 'N/A';
  };

  const getValidationDate = (prestataire: Prestataire): string => {
    // Chercher dans plusieurs emplacements possibles
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
    // Chercher dans plusieurs emplacements possibles
    const rawData = prestataire.raw_data || {};
    const approvalDate = prestataire.approvalDate || 
                         prestataire.approval_date || 
                         rawData.approvalDate || 
                         rawData.approval_date ||
                         rawData.approved_at ||
                         prestataire.approved_at;
    
    return formatDate(approvalDate);
  };

  // Fonction helper pour récupérer validation_status (pas status qui contient l'approbation)
  const getValidationStatus = (prestataire: Prestataire): string => {
    const rawData = prestataire.raw_data || {};
    // Chercher validation_status dans raw_data ou directement sur l'objet
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

  // Fonction helper pour récupérer le montant payé
  const getPaymentAmount = (prestataire: Prestataire): number => {
    const rawData = prestataire.raw_data || {};
    const paymentAmount = (prestataire as any).paymentAmount ||
                         (prestataire as any).payment_amount ||
                         rawData.paymentAmount ||
                         rawData.payment_amount ||
                         0;
    return paymentAmount;
  };

  const getPaymentDate = (prestataire: Prestataire): string => {
    // Chercher dans plusieurs emplacements possibles
    const rawData = prestataire.raw_data || {};
    const paymentDate = prestataire.paymentDate || 
                        prestataire.payment_date || 
                        rawData.paymentDate || 
                        rawData.payment_date ||
                        rawData.paid_at ||
                        prestataire.paid_at;
    
    return formatDate(paymentDate);
  };

  if (user?.role !== 'DPS') {
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
      {alert && (
        <AlertModal
          isOpen={!!alert}
          title={alert.title}
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('province.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('province.province')}: {user.provinceId || t('mcz.notDefined')} {t('province.readOnly')}
        </p>
      </div>

      {/* Statistiques */}
      {stats && (
        <StatCardGroup columns={4}>
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
        </StatCardGroup>
      )}

      {/* Filtres */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t('province.zone')} {zones.length > 0 && `(${zones.length})`}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
            >
              <option value="">{t('province.allZones')}</option>
              {zones.length === 0 ? (
                <option value="" disabled>
                  {t('common.noData')}
                </option>
              ) : (
                zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name || zone.id}
                  </option>
                ))
              )}
            </select>
            {zones.length === 0 && user?.provinceId && (
              <p className="text-xs text-gray-500 mt-1">
                {t('common.loading')} {user.provinceId}...
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t('province.area')} {selectedZoneId && aires.length > 0 && `(${aires.length})`}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              value={selectedAireId}
              onChange={(e) => setSelectedAireId(e.target.value)}
              disabled={!selectedZoneId}
            >
              <option value="">{t('province.allAreas')}</option>
              {!selectedZoneId ? (
                <option value="" disabled>
                  {t('common.select')} {t('province.zone').toLowerCase()}
                </option>
              ) : aires.length === 0 ? (
                <option value="" disabled>
                  {t('common.noData')}
                </option>
              ) : (
                aires.map((aire) => (
                  <option key={aire.id} value={aire.id}>
                    {aire.name || aire.id}
                  </option>
                ))
              )}
            </select>
            {selectedZoneId && aires.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {t('common.loading')} {selectedZoneId}...
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t('common.campaign')}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">{t('province.allCampaigns')}</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t('common.status')}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">{t('province.allStatuses')}</option>
              <option value="ENREGISTRE">{t('status.registered')}</option>
              <option value="VALIDE_PAR_IT">{t('status.validatedByIT')}</option>
              <option value="APPROUVE_PAR_MCZ">{t('status.approvedByMCZ')}</option>
              <option value="REJETE_PAR_MCZ">{t('status.rejectedByMCZ')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des prestataires */}
      {loadingPrestataires ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">{t('province.loadingProviders')}</p>
        </div>
      ) : prestataires.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">{t('province.noProviders')}</p>
          <p className="text-sm text-gray-400 mt-2">
            {filterStatus || selectedZoneId || selectedAireId || selectedCampaignId
              ? 'Essayez de modifier les filtres pour voir plus de résultats'
              : stats && stats.total > 0
              ? `Les statistiques indiquent ${stats.total} prestataire(s) dans cette province, mais aucun n'a été retourné par l'API. Vérifiez les logs de la console.`
              : 'Aucun prestataire dans cette province'}
          </p>
          {stats && stats.total > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Total selon les statistiques: {stats.total} | 
              {/*Enregistrés: {stats.byStatus?.ENREGISTRE || 0} | */}
              Validés par IT: {stats.byStatus?.VALIDE_PAR_IT || 0} | 
              Approuvés: {stats.byStatus?.APPROUVE_PAR_MCZ || 0}
            </p>
          )}
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
              label: t('common.province'),
              render: (_, prestataire) => prestataire.provinceId || (prestataire as any).province_id || user.provinceId || 'N/A',
            },
            {
              key: 'zoneId',
              label: t('common.zone'),
              render: (_, prestataire) => prestataire.zoneId || (prestataire as any).zone_id || 'N/A',
            },
            {
              key: 'aireId',
              label: t('common.area'),
              render: (_, prestataire) => prestataire.aireId || (prestataire as any).aire_id || 'N/A',
            },
            {
              key: 'nom',
              label: t('province.fullName'),
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
              key: 'validationDate',
              label: t('province.validationDate'),
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
              render: (_, prestataire) => getStatusBadge(prestataire.status || 'ENREGISTRE'),
            },
            {
              key: 'approvalDate',
              label: t('province.approvalDate'),
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
              label: t('province.paymentDate'),
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
          title={t('province.providers')}
          exportFilename="prestataires-province"
        />
      )}
    </div>
  );
}
