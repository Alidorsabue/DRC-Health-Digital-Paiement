'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { statsApi, NationalStats, ZoneStats, AireStats, ProvinceStats } from '../../../lib/api/stats';
import { campaignsApi } from '../../../lib/api/campaigns';
import { prestatairesApi, Prestataire } from '../../../lib/api/prestataires';
import { geographicApi } from '../../../lib/api/geographic';
import { Campaign } from '../../../types';
import { getErrorMessage } from '../../../utils/error-handler';
import AlertModal from '../../../components/Modal/AlertModal';
import DataTable, { Column } from '../../../components/DataTable';
import { useTranslation } from '../../../hooks/useTranslation';

interface GeographicOption {
  id: string;
  name: string;
}

export default function StatsPage() {
  console.log('🟡 [StatsPage] RENDER - Début du composant');
  const { user } = useAuthStore();
  console.log('🟡 [StatsPage] RENDER - Hooks de base initialisés', { userId: user?.id, role: user?.role });
  const { t } = useTranslation();
  const [stats, setStats] = useState<NationalStats | ZoneStats | AireStats | ProvinceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [aires, setAires] = useState<GeographicOption[]>([]);
  const [alert, setAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlert({ title, message, type });
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadStats = async () => {
    try {
      setLoading(true);
      console.log('Chargement des statistiques nationales...', { campaignId: selectedCampaignId });
      const filters = selectedCampaignId ? { campaignId: selectedCampaignId } : undefined;
      const data = await statsApi.getNational(filters);
      console.log('Statistiques nationales chargées:', data);
      setStats(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
      const errorMsg = getErrorMessage(error, 'Erreur inconnue');
      showAlert('Erreur', `Impossible de charger les statistiques:\n\n${errorMsg}`, 'error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadStatsForMCZ = async () => {
    if (!user?.zoneId) {
      console.warn('MCZ sans zoneId, impossible de charger les stats');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Chargement des stats pour MCZ zone:', user.zoneId, { campaignId: selectedCampaignId });
      const filters = selectedCampaignId ? { campaignId: selectedCampaignId } : undefined;
      const data = await statsApi.getZone(user.zoneId, filters);
      console.log('Statistiques MCZ chargées:', data);
      setStats(data);
      
      // Charger les prestataires pour le tableau de répartition
      await loadPrestatairesForMCZ();
      // Charger les aires de santé
      await loadAiresForMCZ(user.zoneId);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques MCZ:', error);
      const errorMsg = getErrorMessage(error, 'Erreur inconnue');
      showAlert('Erreur', `Impossible de charger les statistiques MCZ:\n\n${errorMsg}`, 'error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPrestatairesForMCZ = async () => {
    if (!user?.zoneId) return;
    
    try {
      const filters: any = {
        zoneId: user.zoneId,
      };
      if (selectedCampaignId) filters.campaignId = selectedCampaignId;
      
      const data = await prestatairesApi.getAll(filters);
      setPrestataires(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des prestataires MCZ:', error);
      setPrestataires([]);
    }
  };

  const loadAiresForMCZ = async (zoneId: string) => {
    try {
      const airesFromGeo = await geographicApi.getAires(zoneId);
      
      // Récupérer les aires depuis les données (tables form_*)
      let airesFromData: { id: string; name: string }[] = [];
      try {
        airesFromData = await statsApi.getAiresFromData(zoneId);
      } catch (error) {
        console.warn('Impossible de récupérer les aires depuis les données:', error);
      }
      
      // Combiner et dédupliquer les aires
      const allAiresMap = new Map<string, { id: string; name: string }>();
      
      // Ajouter les aires de l'API géographique
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
      setAires(allAires);
    } catch (error: any) {
      console.error('Erreur lors du chargement des aires MCZ:', error);
      setAires([]);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadStatsForDPS = async () => {
    if (!user?.provinceId) {
      console.warn('DPS sans provinceId, impossible de charger les stats');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Chargement des stats pour DPS province:', user.provinceId, { campaignId: selectedCampaignId });
      const filters = selectedCampaignId ? { campaignId: selectedCampaignId } : undefined;
      const data = await statsApi.getProvince(user.provinceId, filters);
      console.log('Statistiques DPS chargées:', data);
      setStats(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques DPS:', error);
      const errorMsg = getErrorMessage(error, 'Erreur inconnue');
      showAlert('Erreur', `Impossible de charger les statistiques DPS:\n\n${errorMsg}`, 'error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Charger les campagnes au démarrage
  useEffect(() => {
    console.log('🟡 [StatsPage] useEffect[fetchCampaigns] - Déclenché', { role: user?.role });
    const fetchCampaigns = async () => {
      try {
        const campaignsData = await campaignsApi.getAll();
        setCampaigns(campaignsData);
        
        // Définir la campagne active par défaut
        if (campaignsData.length > 0 && !selectedCampaignId) {
          const activeCampaign = campaignsData.find(c => c.isActive);
          if (activeCampaign) {
            console.log('DEBUG STATS: Campagne active trouvée, utilisation par défaut:', activeCampaign.id);
            setSelectedCampaignId(activeCampaign.id);
          } else {
            console.log('DEBUG STATS: Aucune campagne active, utilisation de la première:', campaignsData[0].id);
            setSelectedCampaignId(campaignsData[0].id);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des campagnes:', error);
      }
    };

    if (user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'NATIONAL' || user?.role === 'MCZ' || user?.role === 'DPS' || user?.role === 'PARTNER') {
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    console.log('🟡 [StatsPage] useEffect[loadStats] - Déclenché', { role: user?.role, selectedCampaignId });
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Timeout de sécurité pour éviter que loading reste à true indéfiniment
    timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('Timeout lors du chargement des statistiques, passage à false');
        setLoading(false);
      }
    }, 10000); // 10 secondes max

    if (user?.role === 'SUPERADMIN' || user?.role === 'NATIONAL' || user?.role === 'PARTNER') {
      loadStats().then(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    } else if (user?.role === 'MCZ' && user?.zoneId) {
      loadStatsForMCZ().then(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    } else if (user?.role === 'DPS' && user?.provinceId) {
      loadStatsForDPS().then(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
    } else if (user && user.role) {
      // Utilisateur avec un rôle non géré, arrêter le chargement
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    } else if (!user) {
      // Utilisateur non encore chargé, ne pas bloquer
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedCampaignId]);

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!stats) {
    return <div className="text-center py-12">Aucune donnée disponible</div>;
  }

  const subtitle = user?.role === 'MCZ' 
    ? `Vue d'ensemble de la zone: ${user.zoneId || 'Non définie'}`
    : user?.role === 'DPS'
    ? `Vue d'ensemble de la province: ${user.provinceId || 'Non définie'}`
    : "Vue d'ensemble nationale";

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
        <h1 className="text-3xl font-bold text-gray-900">Statistiques</h1>
        <p className="mt-2 text-sm text-gray-600">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Répartition par statut</h2>
          <div className="space-y-3">
            {Object.entries(stats.byStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{status}</span>
                <div className="flex items-center space-x-4">
                  <div className="w-48 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Répartition par province - pour SUPERADMIN, NATIONAL et PARTNER */}
          {(user?.role === 'SUPERADMIN' || user?.role === 'NATIONAL' || user?.role === 'PARTNER') && 'byProvince' in stats && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Répartition par province</h2>
              <div className="space-y-2">
                {Object.entries((stats as NationalStats).byProvince || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([province, count]) => (
                    <div
                      key={province}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">{province}</span>
                      <span className="font-medium text-gray-900">{count as number}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Répartition par zone - pour DPS */}
          {user?.role === 'DPS' && 'byZone' in stats && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Répartition par zone de santé</h2>
              <div className="space-y-2">
                {Object.entries((stats as ProvinceStats).byZone || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([zone, count]) => (
                    <div
                      key={zone}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">{zone}</span>
                      <span className="font-medium text-gray-900">{count as number}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Répartition par aire - pour MCZ */}
          {user?.role === 'MCZ' && 'byAire' in stats && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Répartition par aire de santé</h2>
              <div className="space-y-2">
                {Object.entries((stats as ZoneStats).byAire || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([aire, count]) => (
                    <div
                      key={aire}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600">{aire}</span>
                      <span className="font-medium text-gray-900">{count as number}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Répartition par catégorie</h2>
            <div className="space-y-2">
              {Object.entries(stats.byCategory || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">{category}</span>
                    <span className="font-medium text-gray-900">{count as number}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tableau de répartition par aire de santé pour MCZ */}
      {user?.role === 'MCZ' && prestataires.length > 0 && (
        <div className="mt-8">
          <DataTable
            data={(() => {
              // Calculer les statistiques par aire depuis les prestataires
              const aireStats: Record<string, {
                total: number;
                validesIt: number;
                approuvesMcz: number;
                payes: number;
              }> = {};

              prestataires.forEach((p) => {
                const aireId = p.aireId || p.aire_id || 'N/A';
                if (!aireStats[aireId]) {
                  aireStats[aireId] = {
                    total: 0,
                    validesIt: 0,
                    approuvesMcz: 0,
                    payes: 0,
                  };
                }

                aireStats[aireId].total++;

                // Compter validés par IT
                const validationStatus = (p.validationStatus || p.status || '').toUpperCase();
                if (validationStatus === 'VALIDE_PAR_IT' || validationStatus === 'VALIDATED') {
                  aireStats[aireId].validesIt++;
                }

                // Compter approuvés par MCZ
                const approvalStatus = (p.approvalStatus || p.status || '').toUpperCase();
                if (approvalStatus === 'APPROUVE_PAR_MCZ' || approvalStatus === 'APPROVED') {
                  aireStats[aireId].approuvesMcz++;
                }

                // Compter payés
                const paymentStatus = (p.paymentStatus || '').toUpperCase();
                if (paymentStatus === 'PAID' || paymentStatus === 'PAYE' || paymentStatus === 'PAYÉ') {
                  aireStats[aireId].payes++;
                }
              });

              return Object.entries(aireStats).map(([aireId, stats]) => {
                // Trouver le nom de l'aire depuis la liste des aires
                const aire = aires.find(a => a.id === aireId);
                return {
                  id: aireId,
                  aire: aire ? aire.name : aireId,
                  total: stats.total,
                  payes: stats.payes,
                  validesIt: stats.validesIt,
                  approuvesMcz: stats.approuvesMcz,
                };
              });
            })()}
            columns={[
              {
                key: 'aire',
                label: t('common.area'),
                filterType: 'select',
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
            title="Répartition par Aire de Santé"
            exportFilename="statistiques-par-aire-mcz"
          />
        </div>
      )}
    </div>
  );
}

