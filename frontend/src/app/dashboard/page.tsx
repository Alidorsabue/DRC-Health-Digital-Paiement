'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { statsApi, NationalStats, ProvinceStats, ZoneStats, AireStats } from '../../lib/api/stats';
import { campaignsApi } from '../../lib/api/campaigns';
import { formsApi } from '../../lib/api/forms';
import { geographicApi } from '../../lib/api/geographic';
import { prestatairesApi, Prestataire } from '../../lib/api/prestataires';
import { Campaign, Form } from '../../types';
import Link from 'next/link';
import { getErrorMessage } from '../../utils/error-handler';
import AlertModal from '../../components/Modal/AlertModal';
import StatCardGroup, { StatCard } from '../../components/Statistics/StatCardGroup';
import { useTranslation } from '../../hooks/useTranslation';

interface GeographicOption {
  id: string;
  name: string;
}

export default function DashboardPage() {
  console.log('⚪ [DashboardPage] RENDER - Début du composant');
  const { user } = useAuthStore();
  const { t } = useTranslation();
  console.log('⚪ [DashboardPage] RENDER - Hooks de base initialisés', { userId: user?.id, role: user?.role });
  const [stats, setStats] = useState<NationalStats | ProvinceStats | ZoneStats | AireStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    provinceId: '',
    zoneId: '',
    aireId: '',
    campaignId: '',
    formId: '',
  });
  const [provinces, setProvinces] = useState<GeographicOption[]>([]);
  const [alert, setAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlert({ title, message, type });
  };
  const [zones, setZones] = useState<GeographicOption[]>([]);
  const [aires, setAires] = useState<GeographicOption[]>([]);
  const [loadingGeographic, setLoadingGeographic] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingForms, setLoadingForms] = useState(true);

  useEffect(() => {
    const fetchGeographicData = async () => {
      try {
        console.log('DEBUG DASHBOARD: Chargement des provinces...');
        // Récupérer les provinces depuis les données (tables form_*) - PRIORITÉ
        let provincesFromData: { id: string; name: string }[] = [];
        try {
          provincesFromData = await statsApi.getProvincesFromData();
          console.log('DEBUG DASHBOARD: Provinces depuis les données (tables form_*):', provincesFromData.length, provincesFromData);
        } catch (error) {
          console.warn('DEBUG DASHBOARD: Impossible de récupérer les provinces depuis les données:', error);
        }
        
        // Si aucune province trouvée dans les données, ne rien afficher (pas de prestataires)
        if (provincesFromData.length === 0) {
          console.warn('DEBUG DASHBOARD: Aucune province trouvée dans les tables form_*. Liste vide.');
          setProvinces([]);
          return;
        }
        
        // Récupérer les provinces depuis l'API géographique uniquement pour obtenir les noms complets
        let provincesFromGeo: { id: string; name: string }[] = [];
        try {
          provincesFromGeo = await geographicApi.getProvinces();
          console.log('DEBUG DASHBOARD: Provinces depuis API géographique (pour les noms):', provincesFromGeo.length);
        } catch (error) {
          console.warn('DEBUG DASHBOARD: Impossible de récupérer les provinces depuis l\'API géographique:', error);
        }
        
        // Créer un map des provinces de l'API géographique pour les noms
        const geoProvincesMap = new Map<string, string>();
        provincesFromGeo.forEach(p => {
          geoProvincesMap.set(p.id, p.name);
        });
        
        // Utiliser uniquement les provinces des données, mais avec les noms de l'API géographique si disponibles
        const allProvinces = provincesFromData.map(p => ({
          id: p.id,
          name: geoProvincesMap.get(p.id) || p.name || p.id
        }));
        
        console.log('DEBUG DASHBOARD: Provinces finales (uniquement depuis les données):', allProvinces.length, allProvinces);
        setProvinces(allProvinces);
        
        if (allProvinces.length === 0) {
          console.warn('DEBUG DASHBOARD: Aucune province trouvée');
        }
      } catch (error: any) {
        console.error('DEBUG DASHBOARD: Erreur lors du chargement des provinces:', error);
        console.error('DEBUG DASHBOARD: Détails de l\'erreur:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });
      } finally {
        setLoadingGeographic(false);
      }
    };

    if (user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'NATIONAL') {
      fetchGeographicData();
    } else if (user?.role === 'MCZ' && user?.zoneId) {
      // Pour MCZ, initialiser la zoneId dans les filtres
      setFilters(prev => ({ ...prev, zoneId: user.zoneId || '' }));
      setLoadingGeographic(false);
    } else if (user?.role === 'DPS' && user?.provinceId) {
      // Pour DPS, initialiser la provinceId dans les filtres et charger les zones
      setFilters(prev => ({ ...prev, provinceId: user.provinceId || '' }));
      setLoadingGeographic(false);
      // Charger les zones de la province (combiner API géographique et données)
      const loadZonesForDPS = async () => {
        const provinceId = user.provinceId;
        if (!provinceId) return;
        try {
          console.log('DEBUG DASHBOARD: Chargement des zones pour DPS province:', provinceId);
          // Récupérer les zones depuis l'API géographique
          const zonesFromGeo = await geographicApi.getZones(provinceId);
          console.log('DEBUG DASHBOARD: Zones depuis API géographique pour DPS:', zonesFromGeo.length);
          
          // Récupérer les zones depuis les données (tables form_*)
          let zonesFromData: { id: string; name: string }[] = [];
          try {
            zonesFromData = await statsApi.getZonesFromData(provinceId);
            console.log('DEBUG DASHBOARD: Zones depuis les données pour DPS:', zonesFromData.length);
          } catch (error) {
            console.warn('DEBUG DASHBOARD: Impossible de récupérer les zones depuis les données:', error);
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
          console.log('DEBUG DASHBOARD: Zones combinées pour DPS:', allZones.length, allZones);
          setZones(allZones);
        } catch (error) {
          console.error('Erreur lors du chargement des zones pour DPS:', error);
        }
      };
      loadZonesForDPS();
    }
  }, [user]);

  useEffect(() => {
    const fetchZones = async () => {
      // Pour DPS, utiliser la provinceId de l'utilisateur
      const provinceIdToUse = user?.role === 'DPS' ? user.provinceId : filters.provinceId;
      if (provinceIdToUse && user?.role !== 'DPS') {
        try {
          console.log('DEBUG DASHBOARD: Chargement des zones pour province:', filters.provinceId);
          // Récupérer les zones depuis l'API géographique
          const zonesFromGeo = await geographicApi.getZones(filters.provinceId);
          console.log('DEBUG DASHBOARD: Zones depuis API géographique:', zonesFromGeo.length);
          
          // Récupérer les zones depuis les données (tables form_*)
          let zonesFromData: { id: string; name: string }[] = [];
          try {
            zonesFromData = await statsApi.getZonesFromData(filters.provinceId);
            console.log('DEBUG DASHBOARD: Zones depuis les données:', zonesFromData.length);
          } catch (error) {
            console.warn('DEBUG DASHBOARD: Impossible de récupérer les zones depuis les données:', error);
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
          console.log('DEBUG DASHBOARD: Zones combinées:', allZones.length, allZones);
          setZones(allZones);
        } catch (error: any) {
          console.error('DEBUG DASHBOARD: Erreur lors du chargement des zones:', error);
          console.error('DEBUG DASHBOARD: Détails de l\'erreur:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
        }
      } else {
        setZones([]);
        setFilters((prev) => ({ ...prev, zoneId: '', aireId: '' }));
      }
    };

    fetchZones();
  }, [filters.provinceId]);

  useEffect(() => {
    const fetchAires = async () => {
      const zoneIdToUse = user?.role === 'MCZ' ? user.zoneId : (user?.role === 'DPS' ? filters.zoneId : filters.zoneId);
      if (zoneIdToUse) {
        try {
          console.log('DEBUG DASHBOARD: Chargement des aires pour zone:', zoneIdToUse);
          // Récupérer les aires depuis l'API géographique
          const airesFromGeo = await geographicApi.getAires(zoneIdToUse);
          console.log('DEBUG DASHBOARD: Aires depuis API géographique:', airesFromGeo.length);
          
          // Récupérer les aires depuis les données (tables form_*)
          let airesFromData: { id: string; name: string }[] = [];
          try {
            airesFromData = await statsApi.getAiresFromData(zoneIdToUse);
            console.log('DEBUG DASHBOARD: Aires depuis les données:', airesFromData.length);
          } catch (error) {
            console.warn('DEBUG DASHBOARD: Impossible de récupérer les aires depuis les données:', error);
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
          console.log('DEBUG DASHBOARD: Aires combinées:', allAires.length, allAires);
          setAires(allAires);
        } catch (error: any) {
          console.error('DEBUG DASHBOARD: Erreur lors du chargement des aires:', error);
          console.error('DEBUG DASHBOARD: Détails de l\'erreur:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
        }
      } else {
        setAires([]);
        setFilters((prev) => ({ ...prev, aireId: '' }));
      }
    };

    fetchAires();
  }, [filters.zoneId, user]);

  // Charger les campagnes une seule fois
  useEffect(() => {
    console.log('DEBUG DASHBOARD: useEffect campagnes déclenché', { userRole: user?.role, userExists: !!user });
    
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    
    const fetchCampaigns = async () => {
      try {
        setLoadingCampaigns(true);
        console.log('DEBUG DASHBOARD: Récupération des campagnes...', { userRole: user?.role, userId: user?.id });
        const campaignsData = await campaignsApi.getAll();
        console.log('DEBUG DASHBOARD: Campagnes chargées:', campaignsData.length, campaignsData);
        
        if (isMounted) {
          setCampaigns(campaignsData);
          if (campaignsData.length === 0) {
            console.warn('DEBUG DASHBOARD: Aucune campagne trouvée');
          } else {
            // Définir la campagne active par défaut si aucune campagne n'est sélectionnée
            setFilters((prevFilters) => {
              if (!prevFilters.campaignId) {
                // Chercher une campagne active
                const activeCampaign = campaignsData.find(c => c.isActive);
                if (activeCampaign) {
                  console.log('DEBUG DASHBOARD: Campagne active trouvée, utilisation par défaut:', activeCampaign.id);
                  return { ...prevFilters, campaignId: activeCampaign.id };
                } else if (campaignsData.length > 0) {
                  // Sinon, utiliser la première campagne
                  console.log('DEBUG DASHBOARD: Aucune campagne active, utilisation de la première:', campaignsData[0].id);
                  return { ...prevFilters, campaignId: campaignsData[0].id };
                }
              }
              return prevFilters;
            });
          }
        }
        if (timeoutId) clearTimeout(timeoutId);
      } catch (error: any) {
        console.error('DEBUG DASHBOARD: Erreur lors du chargement des campagnes:', error);
        console.error('DEBUG DASHBOARD: Détails de l\'erreur:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url,
        });
        // En cas d'erreur, initialiser avec un tableau vide pour éviter le blocage
        if (isMounted) {
          setCampaigns([]);
        }
        if (timeoutId) clearTimeout(timeoutId);
      } finally {
        if (isMounted) {
          setLoadingCampaigns(false);
        }
      }
    };

    // Charger les campagnes pour tous les rôles autorisés
    if (user?.role === 'SUPERADMIN' || user?.role === 'NATIONAL' || user?.role === 'MCZ' || user?.role === 'DPS' || user?.role === 'PARTNER') {
      // Timeout de sécurité pour éviter que loadingCampaigns reste à true indéfiniment
      timeoutId = setTimeout(() => {
        console.warn('DEBUG DASHBOARD: Timeout lors du chargement des campagnes, passage à false');
        if (isMounted) {
          setLoadingCampaigns(false);
        }
      }, 10000); // 10 secondes max
      fetchCampaigns();
    } else if (user && user.role) {
      // Si l'utilisateur est chargé mais n'a pas un rôle autorisé, ne pas charger
      console.log('DEBUG DASHBOARD: Rôle non autorisé pour charger les campagnes:', user.role);
      setLoadingCampaigns(false);
      setCampaigns([]);
    } else {
      // Si user n'est pas encore chargé, ne pas bloquer le chargement
      console.log('DEBUG DASHBOARD: Utilisateur non encore chargé, attente...');
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  // Charger les formulaires une seule fois
  useEffect(() => {
    const fetchForms = async () => {
      try {
        setLoadingForms(true);
        console.log('DEBUG DASHBOARD: Récupération des formulaires...');
        const formsData = await formsApi.getAll();
        // Filtrer seulement les formulaires publiés pour le filtre
        const publishedForms = formsData.filter((form) => 
          form.versions?.some((v) => v.isPublished)
        );
        console.log('DEBUG DASHBOARD: Formulaires chargés:', publishedForms.length, publishedForms);
        setForms(publishedForms);
        if (publishedForms.length === 0) {
          console.warn('DEBUG DASHBOARD: Aucun formulaire publié trouvé');
        }
      } catch (error: any) {
        console.error('DEBUG DASHBOARD: Erreur lors du chargement des formulaires:', error);
      } finally {
        setLoadingForms(false);
      }
    };

    if (user?.role === 'SUPERADMIN' || user?.role === 'NATIONAL' || user?.role === 'MCZ' || user?.role === 'DPS' || user?.role === 'PARTNER') {
      fetchForms();
    }
  }, [user]);

  useEffect(() => {
    console.log('DEBUG DASHBOARD: useEffect stats déclenché', { userRole: user?.role, userZoneId: user?.zoneId, filters, loading });
    
    let timeoutId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (user?.role === 'SUPERADMIN' || user?.role === 'NATIONAL' || user?.role === 'PARTNER') {
          setLoading(true);
          console.log('DEBUG DASHBOARD: Chargement des stats...', { filters, role: user?.role });
          let statsData: NationalStats | ProvinceStats | ZoneStats | AireStats;

          const statsFilters = {
            ...(filters.campaignId && { campaignId: filters.campaignId }),
            ...(filters.formId && { formId: filters.formId }),
          };

          if (filters.aireId) {
            console.log('DEBUG DASHBOARD: Récupération stats pour aire:', filters.aireId, statsFilters);
            statsData = await statsApi.getAire(filters.aireId, statsFilters) as AireStats;
          } else if (filters.zoneId) {
            console.log('DEBUG DASHBOARD: Récupération stats pour zone:', filters.zoneId, statsFilters);
            statsData = await statsApi.getZone(filters.zoneId, statsFilters) as ZoneStats;
          } else if (filters.provinceId) {
            console.log('DEBUG DASHBOARD: Récupération stats pour province:', filters.provinceId, statsFilters);
            statsData = await statsApi.getProvince(filters.provinceId, statsFilters) as ProvinceStats;
          } else {
            console.log('DEBUG DASHBOARD: Récupération stats nationales', statsFilters);
            statsData = await statsApi.getNational(statsFilters);
          }

          // Charger les prestataires pour calculer correctement les validés par IT
          let prestatairesData: Prestataire[] = [];
          try {
            const prestatairesFilters: any = {};
            if (filters.campaignId) prestatairesFilters.campaignId = filters.campaignId;
            if (filters.formId) prestatairesFilters.formId = filters.formId;
            if (filters.provinceId) prestatairesFilters.provinceId = filters.provinceId;
            if (filters.zoneId) prestatairesFilters.zoneId = filters.zoneId;
            if (filters.aireId) prestatairesFilters.aireId = filters.aireId;
            prestatairesData = await prestatairesApi.getAll(prestatairesFilters);
            console.log('DEBUG DASHBOARD: Prestataires chargés:', prestatairesData.length);
          } catch (error) {
            console.warn('DEBUG DASHBOARD: Erreur lors du chargement des prestataires:', error);
          }

          console.log('DEBUG DASHBOARD: Stats chargées:', statsData);
          console.log('DEBUG DASHBOARD: Total:', statsData?.total);
          console.log('DEBUG DASHBOARD: byStatus:', statsData?.byStatus);
          if ('byProvince' in (statsData || {})) {
            console.log('DEBUG DASHBOARD: byProvince:', (statsData as NationalStats)?.byProvince);
          }
          
          if (isMounted) {
            // Fonction helper pour déterminer si un prestataire a été validé par IT
            const isValidatedByIT = (p: Prestataire): boolean => {
              const rawData = p.raw_data || {};
              
              // Vérifier validation_status
              let validationStatus = (p as any).validation_status ||
                                    rawData.validation_status ||
                                    (p as any).validationStatus ||
                                    rawData.validationStatus;
              
              if (validationStatus) {
                const statusUpper = String(validationStatus).toUpperCase().trim();
                if (statusUpper === 'VALIDE_PAR_IT' || statusUpper === 'VALIDATED') {
                  return true;
                }
              }
              
              // Vérifier si une date de validation existe (indique validation par IT)
              const validationDate = (p as any).validation_date ||
                                    (p as any).validationDate ||
                                    (p as any).validated_at ||
                                    rawData.validation_date ||
                                    rawData.validationDate ||
                                    rawData.validated_at;
              
              if (validationDate && validationDate !== '-' && validationDate !== null && validationDate !== '') {
                return true;
              }
              
              // Si le statut est APPROUVE_PAR_MCZ, cela signifie qu'il a d'abord été validé par IT
              const status = p.status || rawData.status;
              const statusStr = String(status || '').trim().toUpperCase();
              if (statusStr === 'APPROUVE_PAR_MCZ' || statusStr === 'APPROUVÉ_PAR_MCZ') {
                return true;
              }
              
              // Vérifier aussi validationStatus depuis le champ status si c'est VALIDE_PAR_IT
              const statusFromStatus = (p.validationStatus || '').toUpperCase();
              if (statusFromStatus === 'VALIDE_PAR_IT' || statusFromStatus === 'VALIDATED') {
                return true;
              }
              
              return false;
            };

            // Calculer le nombre réel de prestataires validés par IT
            const validatedByITCount = prestatairesData.filter(isValidatedByIT).length;
            console.log('DEBUG DASHBOARD: Prestataires validés par IT calculés:', validatedByITCount, 'sur', prestatairesData.length);

            // S'assurer que statsData est toujours un objet valide
            if (!statsData) {
              console.warn('DEBUG DASHBOARD: statsData est null/undefined, utilisation d\'un objet vide');
              setStats({
                total: 0,
                byStatus: {
                  VALIDE_PAR_IT: validatedByITCount,
                },
                byProvince: {},
                byCategory: {},
                paid: 0,
              } as NationalStats);
            } else {
              // Normaliser les stats et corriger le nombre de validés par IT
              const normalizedStats: any = {
                total: statsData.total || 0,
                byStatus: {
                  ...(statsData.byStatus || {}),
                  VALIDE_PAR_IT: validatedByITCount, // Utiliser le nombre calculé
                },
                byCategory: statsData.byCategory || {},
                paid: statsData.paid || 0,
              };
              if ('byProvince' in statsData) {
                normalizedStats.byProvince = statsData.byProvince || {};
              }
              if ('byZone' in statsData) {
                normalizedStats.byZone = statsData.byZone || {};
              }
              if ('byAire' in statsData) {
                normalizedStats.byAire = statsData.byAire || {};
              }
              console.log('DEBUG DASHBOARD: Stats normalisées avec VALIDE_PAR_IT corrigé:', normalizedStats);
              setStats(normalizedStats);
              setPrestataires(prestatairesData);
            }
            setLoading(false);
          }
        } else if (user?.role === 'MCZ') {
          // Pour MCZ, charger les stats de sa zone
          if (!user.zoneId) {
            console.warn('DEBUG DASHBOARD: MCZ sans zoneId, impossible de charger les stats');
            if (isMounted) {
              setStats(null);
              setLoading(false);
            }
            if (timeoutId) clearTimeout(timeoutId);
            return;
          }

          setLoading(true);
          console.log('DEBUG DASHBOARD: Chargement des stats pour MCZ zone:', user.zoneId, { filters });
          const statsFilters = {
            ...(filters.campaignId && { campaignId: filters.campaignId }),
            ...(filters.formId && { formId: filters.formId }),
          };

          let statsData: ZoneStats | AireStats;

          if (filters.aireId) {
            console.log('DEBUG DASHBOARD: Récupération stats pour aire:', filters.aireId, statsFilters);
            statsData = await statsApi.getAire(filters.aireId, statsFilters) as AireStats;
          } else {
            console.log('DEBUG DASHBOARD: Récupération stats pour zone MCZ:', user.zoneId, statsFilters);
            statsData = await statsApi.getZone(user.zoneId, statsFilters) as ZoneStats;
          }

          // Charger les prestataires pour calculer correctement les validés par IT
          let prestatairesData: Prestataire[] = [];
          try {
            const prestatairesFilters: any = {
              zoneId: user.zoneId,
            };
            if (filters.campaignId) prestatairesFilters.campaignId = filters.campaignId;
            if (filters.formId) prestatairesFilters.formId = filters.formId;
            prestatairesData = await prestatairesApi.getAll(prestatairesFilters);
            console.log('DEBUG DASHBOARD MCZ: Prestataires chargés:', prestatairesData.length);
          } catch (error) {
            console.warn('DEBUG DASHBOARD MCZ: Erreur lors du chargement des prestataires:', error);
          }

          console.log('DEBUG DASHBOARD: Stats chargées pour MCZ:', statsData);
          
          if (isMounted) {
            // S'assurer que statsData est toujours un objet valide
            if (!statsData) {
              console.warn('DEBUG DASHBOARD MCZ: statsData est null/undefined, utilisation d\'un objet vide');
              setStats({
                total: 0,
                byStatus: {},
                byAire: {},
                byCategory: {},
                paid: 0,
              });
            } else {
              // Fonction helper pour déterminer si un prestataire a été validé par IT
              const isValidatedByIT = (p: Prestataire): boolean => {
                const rawData = p.raw_data || {};
                
                // Vérifier validation_status
                let validationStatus = (p as any).validation_status ||
                                      rawData.validation_status ||
                                      (p as any).validationStatus ||
                                      rawData.validationStatus;
                
                if (validationStatus) {
                  const statusUpper = String(validationStatus).toUpperCase().trim();
                  if (statusUpper === 'VALIDE_PAR_IT' || statusUpper === 'VALIDATED') {
                    return true;
                  }
                }
                
                // Vérifier si une date de validation existe (indique validation par IT)
                const validationDate = (p as any).validation_date ||
                                      (p as any).validationDate ||
                                      (p as any).validated_at ||
                                      rawData.validation_date ||
                                      rawData.validationDate ||
                                      rawData.validated_at;
                
                if (validationDate && validationDate !== '-' && validationDate !== null && validationDate !== '') {
                  return true;
                }
                
                // Si le statut est APPROUVE_PAR_MCZ, cela signifie qu'il a d'abord été validé par IT
                const status = p.status || rawData.status;
                const statusStr = String(status || '').trim().toUpperCase();
                if (statusStr === 'APPROUVE_PAR_MCZ' || statusStr === 'APPROUVÉ_PAR_MCZ') {
                  return true;
                }
                
                // Vérifier aussi validationStatus depuis le champ status si c'est VALIDE_PAR_IT
                const statusFromStatus = (p.validationStatus || '').toUpperCase();
                if (statusFromStatus === 'VALIDE_PAR_IT' || statusFromStatus === 'VALIDATED') {
                  return true;
                }
                
                return false;
              };

              // Calculer le nombre réel de prestataires validés par IT
              const validatedByITCount = prestatairesData.filter(isValidatedByIT).length;
              console.log('DEBUG DASHBOARD MCZ: Prestataires validés par IT calculés:', validatedByITCount, 'sur', prestatairesData.length);

              // Normaliser les stats et corriger le nombre de validés par IT
              const normalizedStats: any = {
                total: statsData.total || 0,
                byStatus: {
                  ...(statsData.byStatus || {}),
                  VALIDE_PAR_IT: validatedByITCount, // Utiliser le nombre calculé
                },
                byCategory: statsData.byCategory || {},
                paid: statsData.paid || 0,
              };
              if ('byAire' in statsData) {
                normalizedStats.byAire = statsData.byAire || {};
              }
              console.log('DEBUG DASHBOARD MCZ: Stats normalisées avec VALIDE_PAR_IT corrigé:', normalizedStats);
              setStats(normalizedStats);
              setPrestataires(prestatairesData);
            }
            setLoading(false);
          }
        } else if (user?.role === 'DPS') {
          // Pour DPS, charger les stats de sa province
          if (!user.provinceId) {
            console.warn('DEBUG DASHBOARD: DPS sans provinceId, impossible de charger les stats');
            if (isMounted) {
              setStats(null);
              setLoading(false);
            }
            if (timeoutId) clearTimeout(timeoutId);
            return;
          }

          setLoading(true);
          console.log('DEBUG DASHBOARD: Chargement des stats pour DPS province:', user.provinceId, { filters });
          const statsFilters = {
            ...(filters.campaignId && { campaignId: filters.campaignId }),
            ...(filters.formId && { formId: filters.formId }),
          };

          let statsData: ProvinceStats | ZoneStats | AireStats;

          if (filters.aireId) {
            console.log('DEBUG DASHBOARD: Récupération stats pour aire:', filters.aireId, statsFilters);
            statsData = await statsApi.getAire(filters.aireId, statsFilters) as AireStats;
          } else if (filters.zoneId) {
            console.log('DEBUG DASHBOARD: Récupération stats pour zone:', filters.zoneId, statsFilters);
            statsData = await statsApi.getZone(filters.zoneId, statsFilters) as ZoneStats;
          } else {
            console.log('DEBUG DASHBOARD: Récupération stats pour province DPS:', user.provinceId, statsFilters);
            statsData = await statsApi.getProvince(user.provinceId, statsFilters) as ProvinceStats;
          }

          // Charger les prestataires pour calculer correctement les validés par IT
          let prestatairesData: Prestataire[] = [];
          try {
            const prestatairesFilters: any = {
              provinceId: user.provinceId,
            };
            if (filters.campaignId) prestatairesFilters.campaignId = filters.campaignId;
            if (filters.formId) prestatairesFilters.formId = filters.formId;
            if (filters.zoneId) prestatairesFilters.zoneId = filters.zoneId;
            if (filters.aireId) prestatairesFilters.aireId = filters.aireId;
            prestatairesData = await prestatairesApi.getAll(prestatairesFilters);
            console.log('DEBUG DASHBOARD DPS: Prestataires chargés:', prestatairesData.length);
          } catch (error) {
            console.warn('DEBUG DASHBOARD DPS: Erreur lors du chargement des prestataires:', error);
          }

          console.log('DEBUG DASHBOARD: Stats chargées pour DPS:', statsData);
          console.log('DEBUG DASHBOARD DPS: Total:', statsData?.total);
          console.log('DEBUG DASHBOARD DPS: byStatus:', statsData?.byStatus);
          
          if (isMounted) {
            // Fonction helper pour déterminer si un prestataire a été validé par IT
            const isValidatedByIT = (p: Prestataire): boolean => {
              const rawData = p.raw_data || {};
              
              // Vérifier validation_status
              let validationStatus = (p as any).validation_status ||
                                    rawData.validation_status ||
                                    (p as any).validationStatus ||
                                    rawData.validationStatus;
              
              if (validationStatus) {
                const statusUpper = String(validationStatus).toUpperCase().trim();
                if (statusUpper === 'VALIDE_PAR_IT' || statusUpper === 'VALIDATED') {
                  return true;
                }
              }
              
              // Vérifier si une date de validation existe (indique validation par IT)
              const validationDate = (p as any).validation_date ||
                                    (p as any).validationDate ||
                                    (p as any).validated_at ||
                                    rawData.validation_date ||
                                    rawData.validationDate ||
                                    rawData.validated_at;
              
              if (validationDate && validationDate !== '-' && validationDate !== null && validationDate !== '') {
                return true;
              }
              
              // Si le statut est APPROUVE_PAR_MCZ, cela signifie qu'il a d'abord été validé par IT
              const status = p.status || rawData.status;
              const statusStr = String(status || '').trim().toUpperCase();
              if (statusStr === 'APPROUVE_PAR_MCZ' || statusStr === 'APPROUVÉ_PAR_MCZ') {
                return true;
              }
              
              // Vérifier aussi validationStatus depuis le champ status si c'est VALIDE_PAR_IT
              const statusFromStatus = (p.validationStatus || '').toUpperCase();
              if (statusFromStatus === 'VALIDE_PAR_IT' || statusFromStatus === 'VALIDATED') {
                return true;
              }
              
              return false;
            };

            // Calculer le nombre réel de prestataires validés par IT
            const validatedByITCount = prestatairesData.filter(isValidatedByIT).length;
            console.log('DEBUG DASHBOARD DPS: Prestataires validés par IT calculés:', validatedByITCount, 'sur', prestatairesData.length);

            // S'assurer que statsData est toujours un objet valide
            if (!statsData) {
              console.warn('DEBUG DASHBOARD DPS: statsData est null/undefined, utilisation d\'un objet vide');
              setStats({
                total: 0,
                byStatus: {
                  VALIDE_PAR_IT: validatedByITCount,
                },
                byZone: {},
                byCategory: {},
                paid: 0,
              });
            } else {
              // Normaliser les stats et corriger le nombre de validés par IT
              const normalizedStats: any = {
                total: statsData.total || 0,
                byStatus: {
                  ...(statsData.byStatus || {}),
                  VALIDE_PAR_IT: validatedByITCount, // Utiliser le nombre calculé
                },
                byCategory: statsData.byCategory || {},
                paid: statsData.paid || 0,
              };
              if ('byZone' in statsData) {
                normalizedStats.byZone = statsData.byZone || {};
              }
              if ('byAire' in statsData) {
                normalizedStats.byAire = statsData.byAire || {};
              }
              console.log('DEBUG DASHBOARD DPS: Stats normalisées avec VALIDE_PAR_IT corrigé:', normalizedStats);
              setStats(normalizedStats);
              setPrestataires(prestatairesData);
            }
            setLoading(false);
          }
        } else if (user && user.role) {
          // Utilisateur avec un rôle non géré
          console.log('DEBUG DASHBOARD: Rôle non géré pour les stats:', user.role);
          if (isMounted) {
            setStats(null);
            setLoading(false);
          }
        } else {
          // Pas d'utilisateur ou rôle non défini
          if (isMounted) {
            setLoading(false);
          }
        }
        if (timeoutId) clearTimeout(timeoutId);
      } catch (error: any) {
        console.error('DEBUG DASHBOARD: Erreur lors du chargement des données:', error);
        const errorMsg = getErrorMessage(error, 'Erreur inconnue');
        if (isMounted) {
          showAlert('Erreur', `Impossible de charger les statistiques:\n\n${errorMsg}`, 'error');
          setStats(null);
          setLoading(false);
        }
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Écouter les événements de rafraîchissement depuis d'autres pages
    const handleRefresh = () => {
      console.log('DEBUG DASHBOARD: Événement de rafraîchissement reçu');
      if (isMounted) {
        fetchData();
      }
    };

    window.addEventListener('dashboard:refresh', handleRefresh);

    // Vérifier le localStorage pour un flag de rafraîchissement
    const checkRefreshFlag = () => {
      const refreshFlag = localStorage.getItem('dashboard:needsRefresh');
      if (refreshFlag === 'true') {
        console.log('DEBUG DASHBOARD: Flag de rafraîchissement détecté');
        localStorage.removeItem('dashboard:needsRefresh');
        if (isMounted) {
          fetchData();
        }
      }
    };

    // Vérifier au montage et périodiquement
    checkRefreshFlag();
    intervalId = setInterval(checkRefreshFlag, 2000); // Vérifier toutes les 2 secondes

    // Ne charger que si l'utilisateur est défini
    if (user) {
      // Timeout de sécurité pour éviter que loading reste à true indéfiniment
      timeoutId = setTimeout(() => {
        console.warn('DEBUG DASHBOARD: Timeout lors du chargement des stats, passage à false');
        if (isMounted) {
          setLoading(false);
        }
      }, 10000); // 10 secondes max
      fetchData();
    } else {
      // Si l'utilisateur n'est pas encore chargé, ne pas bloquer
      console.log('DEBUG DASHBOARD: Utilisateur non encore chargé pour les stats');
      setLoading(false);
    }

    return () => {
      isMounted = false;
      window.removeEventListener('dashboard:refresh', handleRefresh);
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, filters.provinceId, filters.zoneId, filters.aireId, filters.campaignId, filters.formId]);

  // Ne pas bloquer l'affichage si loading, afficher le contenu même pendant le chargement

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
          {t('dashboard.welcome')}, {user?.fullName}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('dashboard.overview')}
        </p>
      </div>

      {(user?.role === 'SUPERADMIN' || user?.role === 'NATIONAL' || user?.role === 'MCZ' || user?.role === 'DPS' || user?.role === 'PARTNER') && (
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className={`grid grid-cols-1 md:grid-cols-2 ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-3`}>
            {user?.role !== 'MCZ' && user?.role !== 'DPS' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('common.province')}
                  </label>
                  <select
                    value={filters.provinceId}
                    onChange={(e) => {
                      setFilters({
                        ...filters,
                        provinceId: e.target.value,
                        zoneId: '',
                        aireId: '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    disabled={loadingGeographic}
                  >
                    <option value="" className="text-gray-900">
                      {loadingGeographic 
                        ? t('common.loading') 
                        : provinces.length === 0 
                          ? t('common.noData') 
                          : t('national.allProvinces')}
                    </option>
                    {provinces.map((province) => (
                      <option key={province.id} value={province.id} className="text-gray-900">
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
                    value={filters.zoneId}
                    onChange={(e) => {
                      setFilters({
                        ...filters,
                        zoneId: e.target.value,
                        aireId: '',
                      });
                    }}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      !filters.provinceId 
                        ? 'text-gray-500 bg-gray-100' 
                        : 'text-gray-900 bg-white'
                    }`}
                    disabled={!filters.provinceId}
                    style={{ color: !filters.provinceId ? '#6b7280' : '#111827' }}
                  >
                    <option value="" style={{ color: '#111827' }}>
                      {!filters.provinceId 
                        ? t('common.select') + ' ' + t('common.province').toLowerCase()
                        : zones.length === 0 
                          ? t('common.noData') 
                          : t('national.allZones')}
                    </option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id} style={{ color: '#111827' }}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {user?.role === 'MCZ' && (
              <div>
                <label className={`block ${user?.role === 'MCZ' ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${user?.role === 'MCZ' ? 'mb-1' : 'mb-2'}`}>
                  {t('common.zone')}
                </label>
                <input
                  type="text"
                  value={user.zoneId || t('mcz.notDefined')}
                  disabled
                  className={`w-full ${user?.role === 'MCZ' ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'} border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600`}
                />
              </div>
            )}

            {user?.role === 'DPS' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('common.province')}
                </label>
                <input
                  type="text"
                  value={user.provinceId || t('mcz.notDefined')}
                  disabled
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-600"
                />
              </div>
            )}

            {user?.role === 'DPS' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Zone de Santé
                </label>
                <select
                  value={filters.zoneId}
                  onChange={(e) => {
                    setFilters({
                      ...filters,
                      zoneId: e.target.value,
                      aireId: '',
                    });
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="" className="text-gray-900">
                    {zones.length === 0 ? 'Aucune zone disponible' : 'Toutes les zones'}
                  </option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id} className="text-gray-900">
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={`block ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'mb-1' : 'mb-2'}`}>
                Aire de Santé
              </label>
              <select
                value={filters.aireId}
                onChange={(e) => {
                  setFilters({ ...filters, aireId: e.target.value });
                }}
                className={`w-full ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'} border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white`}
                disabled={(user?.role === 'MCZ' || user?.role === 'DPS') ? false : !filters.zoneId}
              >
                <option value="" className="text-gray-900">
                  {(user?.role === 'MCZ' || user?.role === 'DPS')
                    ? (aires.length === 0 ? 'Aucune aire disponible' : 'Toutes les aires')
                    : (!filters.zoneId 
                        ? 'Sélectionnez d\'abord une zone' 
                        : aires.length === 0 
                          ? 'Aucune aire disponible' 
                          : 'Toutes les aires')}
                </option>
                {aires.map((aire) => (
                  <option key={aire.id} value={aire.id} className="text-gray-900">
                    {aire.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'mb-1' : 'mb-2'}`}>
                Campagne
              </label>
              <select
                value={filters.campaignId}
                onChange={(e) => {
                  setFilters({ ...filters, campaignId: e.target.value });
                }}
                className={`w-full ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'} border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white`}
                disabled={loadingCampaigns}
              >
                <option value="" className="text-gray-900">
                  {loadingCampaigns 
                    ? 'Chargement...' 
                    : campaigns.length === 0 
                      ? 'Aucune campagne disponible' 
                      : 'Toutes les campagnes'}
                </option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id} className="text-gray-900">
                    {campaign.name} {campaign.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'text-xs' : 'text-sm'} font-medium text-gray-700 ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'mb-1' : 'mb-2'}`}>
                Formulaire
              </label>
              <select
                value={filters.formId}
                onChange={(e) => {
                  setFilters({ ...filters, formId: e.target.value });
                }}
                className={`w-full ${(user?.role === 'MCZ' || user?.role === 'DPS') ? 'px-2 py-1.5 text-sm' : 'px-3 py-2'} border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white`}
                disabled={loadingForms}
              >
                <option value="" className="text-gray-900">
                  {loadingForms 
                    ? 'Chargement...' 
                    : forms.length === 0 
                      ? 'Aucun formulaire disponible' 
                      : 'Tous les formulaires'}
                </option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id} className="text-gray-900">
                    {form.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {!loading && stats && (
        <StatCardGroup columns={5}>
          <StatCard
            title={t('dashboard.totalProviders')}
            value={stats.total || 0}
            icon="👥"
            color="indigo"
            progress={100}
          />
          <StatCard
            title={t('dashboard.approvedByMCZ')}
            value={stats.byStatus?.APPROUVE_PAR_MCZ || 0}
            icon="✅"
            color="green"
            progress={stats.total > 0 ? ((stats.byStatus?.APPROUVE_PAR_MCZ || 0) / stats.total) * 100 : 0}
          />
          <StatCard
            title={t('dashboard.validatedByIT')}
            value={stats.byStatus?.VALIDE_PAR_IT || 0}
            icon="⏳"
            color="yellow"
            progress={stats.total > 0 ? ((stats.byStatus?.VALIDE_PAR_IT || 0) / stats.total) * 100 : 0}
          />
          <StatCard
            title={t('dashboard.paid')}
            value={stats.paid || 0}
            icon="💰"
            color="purple"
            progress={stats.total > 0 ? ((stats.paid || 0) / stats.total) * 100 : 0}
          />
          <StatCard
            title={t('dashboard.activeCampaigns')}
            value={(() => {
              let filteredCampaigns = campaigns.filter((c) => c.isActive);
              if (filters.campaignId) {
                filteredCampaigns = filteredCampaigns.filter(c => c.id === filters.campaignId);
              }
              return filteredCampaigns.length;
            })()}
            icon="🎯"
            color="blue"
            progress={campaigns.length > 0 ? (campaigns.filter((c) => c.isActive).length / campaigns.length) * 100 : 0}
          />
        </StatCardGroup>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              {t('dashboard.recentCampaigns')}
            </h3>
            <div className="space-y-3">
              {(() => {
                // Filtrer les campagnes selon le filtre sélectionné
                let filteredCampaigns = campaigns;
                if (filters.campaignId) {
                  filteredCampaigns = campaigns.filter(c => c.id === filters.campaignId);
                }
                
                if (filteredCampaigns.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">
                        {filters.campaignId 
                          ? 'Aucune campagne correspondant au filtre' 
                          : 'Aucune campagne disponible'}
                      </p>
                      <p className="text-xs mt-2">
                        {filters.campaignId 
                          ? 'Essayez de changer le filtre de campagne' 
                          : 'Les campagnes apparaîtront ici une fois créées'}
                      </p>
                    </div>
                  );
                }
                
                return filteredCampaigns.slice(0, 5).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {campaign.name}
                      </p>
                      <p className="text-xs text-gray-500">{campaign.type}</p>
                    </div>
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
                ));
              })()}
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/campaigns"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {t('dashboard.seeAllCampaigns')}
              </Link>
            </div>
          </div>
        </div>

        {stats && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                {t('dashboard.statusDistribution')}
              </h3>
              <div className="space-y-2">
                {(() => {
                  // Combiner les statuts d'approbation et de paiement
                  const allStatuses: Record<string, number> = { ...(stats.byStatus || {}) };
                  
                  // Ajouter les statuts de paiement si disponibles dans les stats
                  if (stats.paid !== undefined) {
                    allStatuses['PAYÉ'] = stats.paid || 0;
                  }
                  
                  return Object.entries(allStatuses).map(([status, count]) => {
                    let statusLabel = status;
                    if (status === 'ENREGISTRE') statusLabel = t('status.registered');
                    else if (status === 'VALIDE_PAR_IT') statusLabel = t('status.validatedByIT');
                    else if (status === 'APPROUVE_PAR_MCZ') statusLabel = t('status.approvedByMCZ');
                    else if (status === 'REJETE_PAR_MCZ') statusLabel = t('status.rejectedByMCZ');
                    else if (status === 'EN_ATTENTE_PAR_MCZ') statusLabel = t('status.pendingMCZ');
                    else if (status === 'PAYÉ') statusLabel = t('status.paid');
                    
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{statusLabel}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {count}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

