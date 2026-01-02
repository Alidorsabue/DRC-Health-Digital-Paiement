'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { partnersApi, PrestataireForPartner, PaymentReportRow } from '../../../lib/api/partners';
import { campaignsApi } from '../../../lib/api/campaigns';
import { formsApi } from '../../../lib/api/forms';
import { geographicApi } from '../../../lib/api/geographic';
import { statsApi } from '../../../lib/api/stats';
import { Campaign, Form } from '../../../types';
import AlertModal from '../../../components/Modal/AlertModal';
import DataTable, { Column } from '../../../components/DataTable';
import { exportData, ExportColumn, ExportRow } from '../../../utils/export';
import * as XLSX from 'xlsx';
import { useTranslation } from '../../../hooks/useTranslation';

interface GeographicOption {
  id: string;
  name: string;
}

export default function PartnerPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [prestataires, setPrestataires] = useState<PrestataireForPartner[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [provinces, setProvinces] = useState<GeographicOption[]>([]);
  const [zones, setZones] = useState<GeographicOption[]>([]);
  const [aires, setAires] = useState<GeographicOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedAireId, setSelectedAireId] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCalculateAmountModal, setShowCalculateAmountModal] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [rateRules, setRateRules] = useState<Array<{ role: string; currency: string; rate: number }>>([
    { role: '', currency: 'USD', rate: 0 },
  ]);
  const tableRef = useRef<HTMLDivElement>(null);

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

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlertModal({ isOpen: true, title, message, type });
  };

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await campaignsApi.getAll();
      setCampaigns(data);
      setSelectedCampaignId((prev) => {
        if (!prev && data.length > 0) {
          const activeCampaign = data.find(c => c.isActive) || data[0];
          return activeCampaign.id;
        }
        return prev;
      });
    } catch (error: any) {
      console.error('Erreur lors du chargement des campagnes:', error);
      showAlert('Erreur', 'Impossible de charger les campagnes', 'error');
    }
  }, []);

  const loadForms = useCallback(async () => {
    try {
      const data = await formsApi.getAll();
      setForms(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des formulaires:', error);
    }
  }, []);

  const loadProvinces = useCallback(async () => {
    try {
      const data = await geographicApi.getProvinces();
      setProvinces(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des provinces:', error);
    }
  }, []);

  const loadZones = useCallback(async (provinceId: string) => {
    if (!provinceId) {
      setZones([]);
      setAires([]);
      return;
    }
    
    try {
      const zonesFromGeo = await geographicApi.getZones(provinceId);
      let zonesFromData: { id: string; name: string }[] = [];
      try {
        zonesFromData = await statsApi.getZonesFromData(provinceId);
      } catch (error) {
        console.warn('Impossible de récupérer les zones depuis les données:', error);
      }
      
      const allZonesMap = new Map<string, { id: string; name: string }>();
      zonesFromGeo.forEach(z => allZonesMap.set(z.id, z));
      zonesFromData.forEach(z => {
        if (!allZonesMap.has(z.id)) {
          allZonesMap.set(z.id, { id: z.id, name: z.name || z.id });
        }
      });
      
      setZones(Array.from(allZonesMap.values()));
      if (!allZonesMap.has(selectedZoneId)) {
        setSelectedZoneId('');
        setAires([]);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des zones:', error);
      setZones([]);
    }
  }, [selectedZoneId]);

  const loadAires = useCallback(async (zoneId: string) => {
    if (!zoneId) {
      setAires([]);
      return;
    }
    
    try {
      const airesFromGeo = await geographicApi.getAires(zoneId);
      let airesFromData: { id: string; name: string }[] = [];
      try {
        airesFromData = await statsApi.getAiresFromData(zoneId);
      } catch (error) {
        console.warn('Impossible de récupérer les aires depuis les données:', error);
      }
      
      const allAiresMap = new Map<string, { id: string; name: string }>();
      airesFromGeo.forEach(a => allAiresMap.set(a.id, a));
      airesFromData.forEach(a => {
        if (!allAiresMap.has(a.id)) {
          allAiresMap.set(a.id, { id: a.id, name: a.name || a.id });
        }
      });
      
      setAires(Array.from(allAiresMap.values()));
    } catch (error: any) {
      console.error('Erreur lors du chargement des aires:', error);
      setAires([]);
    }
  }, []);

  const loadPrestataires = useCallback(async () => {
    setLoading(true);
    try {
      // Charger les prestataires même sans filtres (le backend gère les cas sans formId/campaignId)
      let data = await partnersApi.getApprovedPrestataires(
        selectedCampaignId || undefined,
        selectedFormId || undefined,
        selectedCategory || undefined,
        selectedProvinceId || undefined,
        selectedZoneId || undefined,
        selectedAireId || undefined,
      );

      console.log(`[loadPrestataires] ${data.length} prestataires chargés`, {
        selectedCampaignId,
        selectedFormId,
        selectedCategory,
        selectedProvinceId,
        selectedZoneId,
        selectedAireId,
        dataSample: data.length > 0 ? data[0] : null,
      });
      
      // Log détaillé pour les premiers prestataires
      if (data.length > 0) {
        console.log('[loadPrestataires] ===== ANALYSE DES PRESTATAIRES =====');
        data.slice(0, 5).forEach((p, index) => {
          console.log(`[loadPrestataires] Prestataire ${index + 1}:`, {
            id: p.id,
            prestataireId: p.prestataireId,
            nom: p.nom,
            prenom: p.prenom,
            categorie: p.categorie,
            role: p.role,
            campaign_role_i_f: p.campaign_role_i_f,
            campaign_role: p.campaign_role,
            role_prestataire: p.role_prestataire,
            presenceDays: p.presenceDays,
            presence_days: p.presence_days,
            enregistrementData: p.enregistrementData,
            allKeys: Object.keys(p),
          });
        });
        
        // Statistiques
        const avecJours = data.filter(p => (p.presenceDays || p.presence_days || 0) > 0).length;
        const avecCategorie = data.filter(p => p.categorie).length;
        const avecRole = data.filter(p => p.role).length;
        const avecCampaignRole = data.filter(p => p.campaign_role_i_f || p.campaign_role).length;
        const avecEnregistrementData = data.filter(p => p.enregistrementData).length;
        
        console.log('[loadPrestataires] Statistiques:', {
          total: data.length,
          avecJours,
          avecCategorie,
          avecRole,
          avecCampaignRole,
          avecEnregistrementData,
        });
      }

      // Filtrer par géographie côté client si nécessaire (sécurité supplémentaire)
      if (selectedProvinceId) {
        data = data.filter(p => {
          const provinceId = p.provinceId || p.province_id || p.province;
          return provinceId === selectedProvinceId;
        });
      }
      if (selectedZoneId) {
        data = data.filter(p => {
          const zoneId = p.zoneId || p.zone_id || p.zone;
          return zoneId === selectedZoneId;
        });
      }
      if (selectedAireId) {
        data = data.filter(p => {
          const aireId = p.aireId || p.aire_id || p.aire;
          return aireId === selectedAireId;
        });
      }

      setPrestataires(data);
      
      // Extraire les catégories uniques pour le filtre
      const categories = new Set<string>();
      data.forEach((p) => {
        const category = p.categorie || p.role || p.campaign_role || p.campaign_role_i_f;
        if (category) {
          categories.add(category);
        }
      });
      setAvailableCategories(Array.from(categories).sort());
    } catch (error: any) {
      console.error('Erreur lors du chargement des prestataires:', error);
      showAlert(t('common.error'), t('partner.errorLoading'), 'error');
      setPrestataires([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaignId, selectedFormId, selectedCategory, selectedProvinceId, selectedZoneId, selectedAireId]);

  useEffect(() => {
    loadCampaigns();
    loadForms();
    loadProvinces();
  }, [loadCampaigns, loadForms, loadProvinces]);

  useEffect(() => {
    loadZones(selectedProvinceId);
  }, [selectedProvinceId, loadZones]);

  useEffect(() => {
    loadAires(selectedZoneId);
  }, [selectedZoneId, loadAires]);

  useEffect(() => {
    loadPrestataires();
  }, [loadPrestataires]);

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    
    const statusLower = status.toLowerCase();
    let bgColor = 'bg-gray-100 text-gray-800';
    
    if (statusLower.includes('approuve') || statusLower === 'approved') {
      bgColor = 'bg-green-100 text-green-800';
    } else if (statusLower.includes('rejete') || statusLower === 'rejected') {
      bgColor = 'bg-red-100 text-red-800';
    } else if (statusLower.includes('valide') || statusLower === 'validated') {
      bgColor = 'bg-blue-100 text-blue-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
        {status}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string | undefined) => {
    if (!status) return <span className="text-gray-500 text-sm">N/A</span>;
    
    const statusLower = status.toLowerCase();
    let bgColor = 'bg-gray-100 text-gray-800';
    
    if (statusLower === 'paid' || statusLower === 'paye') {
      bgColor = 'bg-green-100 text-green-800';
    } else if (statusLower === 'pending' || statusLower === 'en_attente') {
      bgColor = 'bg-yellow-100 text-yellow-800';
    } else if (statusLower === 'failed' || statusLower === 'echec') {
      bgColor = 'bg-red-100 text-red-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
        {status}
      </span>
    );
  };

  // Fonction helper pour récupérer validation_status (pas status qui contient l'approbation)
  const getValidationStatus = (prestataire: PrestataireForPartner): string => {
    const rawData = prestataire.raw_data || {};
    const validationStatus = (prestataire as any).validation_status ||
                            rawData.validation_status ||
                            (prestataire as any).validationStatus ||
                            rawData.validationStatus ||
                            'ENREGISTRE';
    return validationStatus;
  };

  const getValidationDate = (prestataire: PrestataireForPartner): string => {
    const rawData = prestataire.raw_data || {};
    const validationDate = prestataire.validationDate || 
                          prestataire.validation_date || 
                          rawData.validationDate || 
                          rawData.validation_date ||
                          rawData.validated_at ||
                          (prestataire as any).validated_at;
    return formatDate(validationDate);
  };

  const getApprovalDate = (prestataire: PrestataireForPartner): string => {
    const rawData = prestataire.raw_data || {};
    const approvalDate = prestataire.approvalDate || 
                         prestataire.approval_date || 
                         rawData.approvalDate || 
                         rawData.approval_date ||
                         rawData.approved_at ||
                         (prestataire as any).approved_at;
    return formatDate(approvalDate);
  };

  const getPaymentDate = (prestataire: PrestataireForPartner): string => {
    const rawData = prestataire.raw_data || {};
    const paymentDate = prestataire.paymentDate || 
                        prestataire.payment_date || 
                        rawData.paymentDate || 
                        rawData.payment_date ||
                        rawData.paid_at ||
                        (prestataire as any).paid_at;
    return formatDate(paymentDate);
  };

  // Fonction helper pour récupérer le montant payé
  const getPaymentAmount = (prestataire: PrestataireForPartner): string => {
    const paymentStatus = (prestataire.paymentStatus || prestataire.payment_status || '').toLowerCase();
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'paye' || paymentStatus === 'payé';

    if (!isPaid) {
      return 'N/A';
    }

    const rawData = prestataire.raw_data || {};
    const amount = prestataire.paymentAmount || prestataire.payment_amount || rawData.paymentAmount || rawData.payment_amount || 0;
    const currency = prestataire.paymentCurrency || prestataire.amountCurrency || rawData.paymentCurrency || 'USD';
    let currencySymbol = '$';
    if (currency === 'CDF') {
      currencySymbol = 'FC';
    } else if (currency === 'EURO') {
      currencySymbol = '€';
    }
    return amount > 0 ? `${amount} ${currencySymbol}` : 'N/A';
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf' | 'image') => {
    setShowExportMenu(false);
    
    // Préparer les colonnes pour l'export
    const exportColumns: ExportColumn[] = columns.map((col) => ({
      key: col.key,
      label: col.label,
    }));

    // Préparer les données pour l'export (sans le rendu personnalisé)
    const exportDataRows: ExportRow[] = prestataires.map((row) => {
      const exportRow: ExportRow = {};
      columns.forEach((col) => {
        // Extraire la valeur textuelle si c'est un rendu personnalisé
        if (col.render) {
          const rendered = col.render(row[col.key], row);
          // Essayer d'extraire le texte
          if (typeof rendered === 'string') {
            exportRow[col.key] = rendered;
          } else if (rendered && typeof rendered === 'object' && 'props' in rendered) {
            exportRow[col.key] = rendered.props?.children || row[col.key] || '';
          } else {
            exportRow[col.key] = row[col.key] || '';
          }
        } else {
          exportRow[col.key] = row[col.key] || '';
        }
      });
      return exportRow;
    });

    const tableElement = tableRef.current?.querySelector('table') || undefined;
    const filename = 'prestataires-approuves';
    
    await exportData(
      format,
      exportDataRows,
      exportColumns,
      filename,
      tableElement as HTMLElement | undefined,
      t('partner.title')
    );
  };

  const handleAddRateRule = () => {
    setRateRules([...rateRules, { role: '', currency: 'USD', rate: 0 }]);
  };

  const handleRemoveRateRule = (index: number) => {
    if (rateRules.length > 1) {
      setRateRules(rateRules.filter((_, i) => i !== index));
    }
  };

  const handleUpdateRateRule = (index: number, field: 'role' | 'currency' | 'rate', value: string | number) => {
    const updated = [...rateRules];
    updated[index] = { ...updated[index], [field]: value };
    setRateRules(updated);
  };

  // Fonction pour normaliser un texte (enlever accents, espaces, mettre en minuscule)
  const normalizeText = useCallback((text: string): string => {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  }, []);

  // Fonction pour extraire le rôle d'un prestataire (chercher dans tous les champs possibles)
  const extractRole = useCallback((p: PrestataireForPartner, debug: boolean = false): string => {
    // Chercher dans l'ordre de priorité (comme le backend)
    const role = 
      p.categorie ||
      p.role ||
      p.campaign_role_i_f ||
      p.campaign_role ||
      p.role_prestataire ||
      (p.enregistrementData && (
        p.enregistrementData.categorie ||
        p.enregistrementData.campaign_role_i_f ||
        p.enregistrementData.campaign_role ||
        p.enregistrementData.role ||
        p.enregistrementData.role_prestataire
      )) ||
      '';
    
    if (debug) {
      console.log(`[extractRole] Prestataire ${p.prestataireId || p.id}:`, {
        categorie: p.categorie,
        role: p.role,
        campaign_role_i_f: p.campaign_role_i_f,
        campaign_role: p.campaign_role,
        role_prestataire: p.role_prestataire,
        enregistrementData: p.enregistrementData,
        roleTrouve: role,
        roleNormalise: normalizeText(role),
      });
    }
    
    return normalizeText(role);
  }, [normalizeText]);

  const handleCalculateAmount = async () => {
    setCalculating(true);
    try {
      console.log('[handleCalculateAmount] ===== DÉBUT DU CALCUL =====');
      console.log('[handleCalculateAmount] Nombre de prestataires:', prestataires.length);
      console.log('[handleCalculateAmount] Règles définies:', rateRules);
      
      // Valider que tous les rôles ont un tarif
      const validRules = rateRules.filter(rule => rule.role && rule.currency && rule.rate > 0);
      console.log('[handleCalculateAmount] Règles valides:', validRules);
      
      if (validRules.length === 0) {
        showAlert('Erreur', 'Veuillez définir au moins une règle de tarification avec un rôle, une devise et un montant unitaire', 'error');
        setCalculating(false);
        return;
      }

      // Créer un map pour accès rapide par rôle (incluant la devise)
      // Utiliser la normalisation pour les clés du map
      const rateMap = new Map<string, { rate: number; currency: string; originalRole: string }>();
      validRules.forEach(rule => {
        const normalizedRole = normalizeText(rule.role);
        // Stocker aussi le rôle original pour les logs
        rateMap.set(normalizedRole, { 
          rate: rule.rate, 
          currency: rule.currency,
          originalRole: rule.role 
        });
        console.log(`[handleCalculateAmount] Règle ajoutée au map: "${rule.role}" -> "${normalizedRole}" (normalisé)`);
      });
      
      console.log('[handleCalculateAmount] RateMap créé avec', rateMap.size, 'entrées:', Array.from(rateMap.entries()));


      // Calculer le montant pour chaque prestataire selon son rôle
      const amounts: Array<{ prestataireId: string; amount: number; currency: string }> = [];
      let prestatairesAvecJours = 0;
      let prestatairesSansRole = 0;
      let prestatairesSansCorrespondance = 0;
      
      prestataires.forEach((p, index) => {
        const days = p.presenceDays || p.presence_days || 0;
        
        // Log pour les premiers prestataires
        if (index < 5) {
          console.log(`[handleCalculateAmount] Prestataire ${index + 1}/${prestataires.length}:`, {
            id: p.prestataireId || p.id,
            nom: p.nom || p.prenom,
            days,
            presenceDays: p.presenceDays,
            presence_days: p.presence_days,
            categorie: p.categorie,
            role: p.role,
            campaign_role_i_f: p.campaign_role_i_f,
            campaign_role: p.campaign_role,
            enregistrementData: p.enregistrementData,
          });
        }
        
        if (days > 0) {
          prestatairesAvecJours++;
          const prestataireRole = extractRole(p, index < 5); // Debug pour les 5 premiers
          
          if (!prestataireRole) {
            prestatairesSansRole++;
            console.warn(`[handleCalculateAmount] Prestataire ${p.prestataireId || p.id} n'a pas de rôle défini. Données:`, {
              categorie: p.categorie,
              role: p.role,
              campaign_role_i_f: p.campaign_role_i_f,
              campaign_role: p.campaign_role,
              enregistrementData: p.enregistrementData,
            });
            return;
          }
          
          console.log(`[handleCalculateAmount] Prestataire ${p.prestataireId || p.id}: rôle extrait = "${prestataireRole}" (normalisé)`);
          
          // Chercher le tarif correspondant au rôle du prestataire
          let rateInfo: { rate: number; currency: string; originalRole?: string } | undefined = undefined;
          
          // Recherche exacte d'abord
          if (rateMap.has(prestataireRole)) {
            rateInfo = rateMap.get(prestataireRole)!;
            console.log(`[handleCalculateAmount] ✓ Correspondance exacte trouvée: "${prestataireRole}" (règle: "${rateInfo.originalRole}")`);
          } else {
            // Recherche partielle (si le rôle contient un des mots-clés)
            const rateEntries = Array.from(rateMap.entries());
            console.log(`[handleCalculateAmount] Recherche partielle pour "${prestataireRole}" parmi ${rateEntries.length} règles...`);
            for (const [roleKey, info] of rateEntries) {
              // Comparaison bidirectionnelle normalisée
              const match1 = prestataireRole.includes(roleKey);
              const match2 = roleKey.includes(prestataireRole);
              console.log(`[handleCalculateAmount]   Comparaison: "${prestataireRole}" vs "${roleKey}" (règle: "${info.originalRole}") -> includes1=${match1}, includes2=${match2}`);
              
              if (match1 || match2) {
                rateInfo = info;
                console.log(`[handleCalculateAmount] ✓ Correspondance partielle trouvée: "${prestataireRole}" correspond à "${info.originalRole || roleKey}"`);
                break;
              }
            }
          }

          if (rateInfo !== undefined && rateInfo.rate > 0) {
            const calculatedAmount = days * rateInfo.rate;
            amounts.push({
              prestataireId: p.prestataireId || p.id,
              amount: calculatedAmount,
              currency: rateInfo.currency,
            });
            console.log(`[handleCalculateAmount] ✓ Montant calculé pour ${p.prestataireId || p.id} (rôle: "${prestataireRole}"): ${days} jours × ${rateInfo.rate} = ${calculatedAmount} ${rateInfo.currency}`);
          } else {
            prestatairesSansCorrespondance++;
            console.warn(`[handleCalculateAmount] ✗ Aucun tarif trouvé pour le prestataire ${p.prestataireId || p.id} avec le rôle "${prestataireRole}"`);
            console.warn(`[handleCalculateAmount]   Rôles disponibles dans les règles:`, Array.from(rateMap.keys()));
          }
        }
      });
      
      console.log('[handleCalculateAmount] ===== RÉSUMÉ =====');
      console.log(`[handleCalculateAmount] Total prestataires: ${prestataires.length}`);
      console.log(`[handleCalculateAmount] Prestataires avec jours > 0: ${prestatairesAvecJours}`);
      console.log(`[handleCalculateAmount] Prestataires sans rôle: ${prestatairesSansRole}`);
      console.log(`[handleCalculateAmount] Prestataires sans correspondance: ${prestatairesSansCorrespondance}`);
      console.log(`[handleCalculateAmount] Montants calculés: ${amounts.length}`);

      if (amounts.length === 0) {
        showAlert('Avertissement', 'Aucun prestataire correspondant aux rôles définis avec des jours de présence trouvé', 'warning');
        setCalculating(false);
        return;
      }

      // Enregistrer les montants via l'API
      await partnersApi.updatePaymentAmounts({ amounts }, selectedFormId || undefined);

      // Mettre à jour l'état local (avec la devise)
      setPrestataires(prevPrestataires =>
        prevPrestataires.map(p => {
          const amountData = amounts.find(a => a.prestataireId === (p.prestataireId || p.id));
          if (amountData) {
            return { ...p, amountToPay: amountData.amount, amountCurrency: amountData.currency };
          }
          return p;
        })
      );

      showAlert('Succès', `${amounts.length} montants calculés et enregistrés avec succès`, 'success');
      setShowCalculateAmountModal(false);
      setRateRules([{ role: '', currency: 'USD', rate: 0 }]); // Réinitialiser
      loadPrestataires();
    } catch (error: any) {
      console.error('Erreur lors du calcul:', error);
      showAlert('Erreur', error.message || 'Erreur lors du calcul des montants', 'error');
    } finally {
      setCalculating(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  /**
   * Normalise une date au format ISO 8601
   * Accepte plusieurs formats : DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, dates Excel (numériques), etc.
   */
  const normalizeDateToISO = (dateValue: string | number | undefined | null): string | undefined => {
    if (!dateValue) {
      return undefined;
    }

    // Si c'est un nombre (format Excel : jours depuis le 1er janvier 1900)
    if (typeof dateValue === 'number') {
      // Excel compte depuis le 30 décembre 1899 (Excel bug), donc on ajoute 1 jour
      const excelEpoch = new Date(1899, 11, 30); // 30 décembre 1899
      const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    const trimmed = String(dateValue).trim();
    if (!trimmed) {
      return undefined;
    }

    // Si c'est déjà au format ISO 8601, retourner tel quel
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(trimmed)) {
      return trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00.000Z`;
    }

    try {
      // Essayer de parser avec Date (gère plusieurs formats)
      const date = new Date(trimmed);
      
      // Vérifier que la date est valide
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }

      // Essayer des formats spécifiques
      if (trimmed.includes('/') || trimmed.includes('-')) {
        const parts = trimmed.split(/[-\/]/);
        if (parts.length === 3) {
          let year, month, day;
          
          // Si le premier élément a 4 chiffres, c'est YYYY-MM-DD ou YYYY/MM/DD
          if (parts[0].length === 4) {
            year = parts[0];
            month = parts[1];
            day = parts[2];
          } else {
            // Sinon, essayer DD/MM/YYYY (format français le plus courant)
            // On suppose DD/MM/YYYY plutôt que MM/DD/YYYY pour la RDC
            day = parts[0];
            month = parts[1];
            year = parts[2];
          }
          
          const isoDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
          if (!isNaN(isoDate.getTime())) {
            return isoDate.toISOString();
          }
        }
      }
      
      console.warn(`Format de date non reconnu: ${trimmed}`);
      return undefined;
    } catch (error) {
      console.warn(`Erreur lors de la conversion de la date: ${trimmed}`, error);
      return undefined;
    }
  };

  const handleImportPaymentReport = async () => {
    if (!importFile) {
      showAlert('Erreur', 'Veuillez sélectionner un fichier', 'error');
      return;
    }

    setImporting(true);
    try {
      const payments: PaymentReportRow[] = [];
      const fileName = importFile.name.toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      if (isExcel) {
        // Lire le fichier Excel
        const arrayBuffer = await importFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length < 2) {
          showAlert('Erreur', 'Le fichier Excel doit contenir au moins un en-tête et une ligne de données', 'error');
          setImporting(false);
          return;
        }

        const headers = (data[0] as any[]).map((h: any) => String(h).toLowerCase().trim());
        
        // Trouver les indices des colonnes (reconnaissance flexible des labels français et anglais)
        const prestataireIdIndex = headers.findIndex(h => 
          (h.includes('prestataire') && h.includes('id')) || 
          h === 'prestataireid' || 
          h === 'id prestataire' ||
          h.startsWith('id prestataire')
        );
        
        const statusIndex = headers.findIndex(h => {
          const lower = h.toLowerCase().trim();
          return lower === 'status' || 
                 lower === 'statut' ||
                 lower === 'statut paiement' ||
                 lower === 'payment status' ||
                 lower.startsWith('statut paiem') || // Pour "Statut Paieme" (tronqué)
                 lower.startsWith('statut pai') || // Pour variantes
                 (lower.includes('statut') && lower.includes('paiement')) ||
                 (lower.includes('statut') && lower.includes('paiem')) || // Pour variantes tronquées
                 (lower.includes('payment') && lower.includes('status'));
        });
        
        const paymentDateIndex = headers.findIndex(h => {
          const lower = h.toLowerCase().trim();
          return (lower.includes('payment') && lower.includes('date')) ||
                 (lower.includes('date') && lower.includes('paiement')) ||
                 (lower.includes('date') && lower.includes('paiem')) || // Pour "Date Paiemen"
                 lower === 'date paiement' ||
                 lower.startsWith('date paiem') || // Pour "Date Paiemen" (tronqué)
                 lower === 'date de paiement' ||
                 lower === 'payment date';
        });
        
        const transactionIdIndex = headers.findIndex(h => 
          (h.includes('transaction') && h.includes('id')) ||
          h === 'transactionid' ||
          h === 'id transaction' ||
          h === 'transaction id'
        );
        
        const paymentReferenceIndex = headers.findIndex(h => 
          (h.includes('payment') && h.includes('reference')) ||
          (h.includes('référence') && h.includes('paiement')) ||
          (h.includes('reference') && h.includes('paiement')) ||
          h === 'payment reference' ||
          h === 'référence paiement'
        );
        
        const paymentAmountIndex = headers.findIndex(h => {
          const lower = h.toLowerCase().trim();
          return (lower.includes('payment') && lower.includes('amount')) ||
                 (lower.includes('montant') && lower.includes('payé')) ||
                 (lower.includes('montant') && lower.includes('payé')) ||
                 (lower.includes('montant') && lower.includes('payer')) ||
                 lower === 'payment amount' ||
                 lower === 'montant payé' ||
                 lower.startsWith('montant pay') || // Pour "Montant payé"
                 lower === 'montant payer';
        });

        if (prestataireIdIndex === -1) {
          const availableHeaders = headers.join(', ');
          showAlert('Erreur', `Le fichier doit contenir une colonne "ID Prestataire" ou "prestataireId". Colonnes trouvées: ${availableHeaders}`, 'error');
          setImporting(false);
          return;
        }
        
        if (statusIndex === -1) {
          const availableHeaders = headers.join(', ');
          showAlert('Erreur', `Le fichier doit contenir une colonne "Statut Paiement" ou "status". Colonnes trouvées: ${availableHeaders}`, 'error');
          setImporting(false);
          return;
        }
        
        console.log('Colonnes détectées (Excel):', {
          prestataireId: headers[prestataireIdIndex],
          status: headers[statusIndex],
          paymentDate: paymentDateIndex >= 0 ? headers[paymentDateIndex] : 'non trouvée',
          transactionId: transactionIdIndex >= 0 ? headers[transactionIdIndex] : 'non trouvée',
          paymentReference: paymentReferenceIndex >= 0 ? headers[paymentReferenceIndex] : 'non trouvée',
          paymentAmount: paymentAmountIndex >= 0 ? headers[paymentAmountIndex] : 'non trouvée',
        });

        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length === 0) continue;

          const prestataireId = String(row[prestataireIdIndex] || '').trim();
          const statusRaw = String(row[statusIndex] || '').trim();

          if (!prestataireId || !statusRaw) continue;

          // Normaliser le statut (accepter les valeurs en français et anglais, avec ou sans accents)
          const statusUpper = statusRaw.toUpperCase();
          let normalizedStatus: 'PENDING' | 'SENT' | 'PAID' | 'FAILED' = 'PENDING';
          
          // Vérifier les statuts en français
          if (statusUpper === 'PAYE' || statusUpper === 'PAYÉ' || statusUpper === 'PAID' || 
              statusRaw.toLowerCase().includes('payé') || statusRaw.toLowerCase().includes('paye')) {
            normalizedStatus = 'PAID';
          } else if (statusUpper === 'ENVOYE' || statusUpper === 'ENVOYÉ' || statusUpper === 'SENT' ||
                     statusRaw.toLowerCase().includes('envoyé') || statusRaw.toLowerCase().includes('envoye')) {
            normalizedStatus = 'SENT';
          } else if (statusUpper === 'ECHEC' || statusUpper === 'ÉCHEC' || statusUpper === 'FAILED' ||
                     statusRaw.toLowerCase().includes('échec') || statusRaw.toLowerCase().includes('echec')) {
            normalizedStatus = 'FAILED';
          } else if (statusUpper === 'EN ATTENTE' || statusUpper === 'PENDING' ||
                     statusRaw.toLowerCase().includes('en attente') || statusRaw.toLowerCase().includes('pending')) {
            normalizedStatus = 'PENDING';
          } else {
            // Si le statut n'est pas reconnu, on le saute avec un warning
            console.warn(`Statut non reconnu pour ${prestataireId}: ${statusRaw}`);
            continue;
          }

          const paymentDateRaw = paymentDateIndex >= 0 && row[paymentDateIndex] !== undefined && row[paymentDateIndex] !== null ? row[paymentDateIndex] : undefined;
          const paymentDateISO = normalizeDateToISO(paymentDateRaw);

          payments.push({
            prestataireId,
            status: normalizedStatus,
            paymentDate: paymentDateISO,
            transactionId: transactionIdIndex >= 0 && row[transactionIdIndex] ? String(row[transactionIdIndex]).trim() : undefined,
            paymentReference: paymentReferenceIndex >= 0 && row[paymentReferenceIndex] ? String(row[paymentReferenceIndex]).trim() : undefined,
            paymentAmount: paymentAmountIndex >= 0 && row[paymentAmountIndex] ? (() => {
              const amountValue = row[paymentAmountIndex];
              if (typeof amountValue === 'number') return amountValue;
              // Nettoyer la chaîne : enlever les espaces, $, FC, €, etc.
              const cleaned = String(amountValue).replace(/[$€FC\s,]/g, '').trim();
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? undefined : parsed;
            })() : undefined,
          });
        }
      } else {
        // Lire le fichier CSV
        const text = await importFile.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          showAlert('Erreur', 'Le fichier CSV doit contenir au moins un en-tête et une ligne de données', 'error');
          setImporting(false);
          return;
        }

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        
        // Trouver les indices des colonnes (reconnaissance flexible des labels français et anglais)
        const prestataireIdIndex = headers.findIndex(h => 
          (h.includes('prestataire') && h.includes('id')) || 
          h === 'prestataireid' || 
          h === 'id prestataire' ||
          h.startsWith('id prestataire')
        );
        
        const statusIndex = headers.findIndex(h => {
          const lower = h.toLowerCase().trim();
          return lower === 'status' || 
                 lower === 'statut' ||
                 lower === 'statut paiement' ||
                 lower === 'payment status' ||
                 lower.startsWith('statut paiem') || // Pour "Statut Paieme" (tronqué)
                 lower.startsWith('statut pai') || // Pour variantes
                 (lower.includes('statut') && lower.includes('paiement')) ||
                 (lower.includes('statut') && lower.includes('paiem')) || // Pour variantes tronquées
                 (lower.includes('payment') && lower.includes('status'));
        });
        
        const paymentDateIndex = headers.findIndex(h => {
          const lower = h.toLowerCase().trim();
          return (lower.includes('payment') && lower.includes('date')) ||
                 (lower.includes('date') && lower.includes('paiement')) ||
                 (lower.includes('date') && lower.includes('paiem')) || // Pour "Date Paiemen"
                 lower === 'date paiement' ||
                 lower.startsWith('date paiem') || // Pour "Date Paiemen" (tronqué)
                 lower === 'date de paiement' ||
                 lower === 'payment date';
        });
        
        const transactionIdIndex = headers.findIndex(h => 
          (h.includes('transaction') && h.includes('id')) ||
          h === 'transactionid' ||
          h === 'id transaction' ||
          h === 'transaction id'
        );
        
        const paymentReferenceIndex = headers.findIndex(h => 
          (h.includes('payment') && h.includes('reference')) ||
          (h.includes('référence') && h.includes('paiement')) ||
          (h.includes('reference') && h.includes('paiement')) ||
          h === 'payment reference' ||
          h === 'référence paiement'
        );
        
        const paymentAmountIndex = headers.findIndex(h => {
          const lower = h.toLowerCase().trim();
          return (lower.includes('payment') && lower.includes('amount')) ||
                 (lower.includes('montant') && lower.includes('payé')) ||
                 (lower.includes('montant') && lower.includes('payé')) ||
                 (lower.includes('montant') && lower.includes('payer')) ||
                 lower === 'payment amount' ||
                 lower === 'montant payé' ||
                 lower.startsWith('montant pay') || // Pour "Montant payé"
                 lower === 'montant payer';
        });

        if (prestataireIdIndex === -1) {
          const availableHeaders = headers.join(', ');
          showAlert('Erreur', `Le fichier doit contenir une colonne "ID Prestataire" ou "prestataireId". Colonnes trouvées: ${availableHeaders}`, 'error');
          setImporting(false);
          return;
        }
        
        if (statusIndex === -1) {
          const availableHeaders = headers.join(', ');
          showAlert('Erreur', `Le fichier doit contenir une colonne "Statut Paiement" ou "status". Colonnes trouvées: ${availableHeaders}`, 'error');
          setImporting(false);
          return;
        }
        
        console.log('Colonnes détectées (CSV):', {
          prestataireId: headers[prestataireIdIndex],
          status: headers[statusIndex],
          paymentDate: paymentDateIndex >= 0 ? headers[paymentDateIndex] : 'non trouvée',
          transactionId: transactionIdIndex >= 0 ? headers[transactionIdIndex] : 'non trouvée',
          paymentReference: paymentReferenceIndex >= 0 ? headers[paymentReferenceIndex] : 'non trouvée',
          paymentAmount: paymentAmountIndex >= 0 ? headers[paymentAmountIndex] : 'non trouvée',
        });
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 2) continue;

          const prestataireId = values[prestataireIdIndex]?.trim() || '';
          const statusRaw = values[statusIndex]?.trim() || '';

          if (!prestataireId || !statusRaw) continue;

          // Normaliser le statut (accepter les valeurs en français et anglais, avec ou sans accents)
          const statusUpper = statusRaw.toUpperCase();
          let normalizedStatus: 'PENDING' | 'SENT' | 'PAID' | 'FAILED' = 'PENDING';
          
          // Vérifier les statuts en français
          if (statusUpper === 'PAYE' || statusUpper === 'PAYÉ' || statusUpper === 'PAID' || 
              statusRaw.toLowerCase().includes('payé') || statusRaw.toLowerCase().includes('paye')) {
            normalizedStatus = 'PAID';
          } else if (statusUpper === 'ENVOYE' || statusUpper === 'ENVOYÉ' || statusUpper === 'SENT' ||
                     statusRaw.toLowerCase().includes('envoyé') || statusRaw.toLowerCase().includes('envoye')) {
            normalizedStatus = 'SENT';
          } else if (statusUpper === 'ECHEC' || statusUpper === 'ÉCHEC' || statusUpper === 'FAILED' ||
                     statusRaw.toLowerCase().includes('échec') || statusRaw.toLowerCase().includes('echec')) {
            normalizedStatus = 'FAILED';
          } else if (statusUpper === 'EN ATTENTE' || statusUpper === 'PENDING' ||
                     statusRaw.toLowerCase().includes('en attente') || statusRaw.toLowerCase().includes('pending')) {
            normalizedStatus = 'PENDING';
          } else {
            // Si le statut n'est pas reconnu, on le saute avec un warning
            console.warn(`Statut non reconnu pour ${prestataireId}: ${statusRaw}`);
            continue;
          }

          const paymentDateRaw = paymentDateIndex >= 0 && values[paymentDateIndex] ? values[paymentDateIndex].trim() : undefined;
          const paymentDateISO = normalizeDateToISO(paymentDateRaw);

          payments.push({
            prestataireId,
            status: normalizedStatus,
            paymentDate: paymentDateISO,
            transactionId: transactionIdIndex >= 0 && values[transactionIdIndex] ? values[transactionIdIndex].trim() : undefined,
            paymentReference: paymentReferenceIndex >= 0 && values[paymentReferenceIndex] ? values[paymentReferenceIndex].trim() : undefined,
            paymentAmount: paymentAmountIndex >= 0 && values[paymentAmountIndex] ? (() => {
              const amountValue = values[paymentAmountIndex];
              // Nettoyer la chaîne : enlever les espaces, $, FC, €, etc.
              const cleaned = String(amountValue).replace(/[$€FC\s,]/g, '').trim();
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? undefined : parsed;
            })() : undefined,
          });
        }
      }

      if (payments.length === 0) {
        showAlert('Erreur', 'Aucun paiement valide trouvé dans le fichier', 'error');
        setImporting(false);
        return;
      }

      const result = await partnersApi.importPaymentReport(
        { payments },
        selectedFormId || undefined,
      );

      // Créer un map des paiements pour mise à jour rapide
      const paymentsMap = new Map<string, PaymentReportRow>();
      payments.forEach(p => {
        paymentsMap.set(p.prestataireId, p);
      });

      if (result.errors.length > 0) {
        showAlert(
          'Import partiel',
          `${result.success} paiements importés avec succès. ${result.errors.length} erreurs.`,
          'warning',
        );
      } else {
        showAlert('Succès', `${result.success} paiements importés avec succès`, 'success');
      }

      setShowImportModal(false);
      setImportFile(null);
      
      // Recharger les données depuis le serveur pour avoir les dernières mises à jour
      // avec un délai pour laisser le backend terminer la mise à jour
      // Mettre à jour immédiatement aussi pour avoir un feedback rapide
      setPrestataires(prevPrestataires => {
        if (prevPrestataires.length === 0) {
          return prevPrestataires; // Sera rechargé par setTimeout
        }
        
        return prevPrestataires.map(p => {
          const paymentUpdate = paymentsMap.get(p.prestataireId || p.id);
          if (paymentUpdate) {
            // Mettre à jour les informations de paiement
            return {
              ...p,
              paymentStatus: paymentUpdate.status,
              paymentAmount: paymentUpdate.paymentAmount || p.paymentAmount,
              paymentDate: paymentUpdate.paymentDate || p.paymentDate,
              payment_status: paymentUpdate.status,
              payment_amount: paymentUpdate.paymentAmount || p.payment_amount,
              payment_date: paymentUpdate.paymentDate || p.payment_date,
            };
          }
          return p;
        });
      });
      
      // Recharger depuis le serveur après un délai
      setTimeout(() => {
        console.log('[handleImportPaymentReport] Rechargement des prestataires après import');
        loadPrestataires();
        
        // Notifier le dashboard principal de se rafraîchir
        localStorage.setItem('dashboard:needsRefresh', 'true');
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
      }, 1000);
    } catch (error: any) {
      console.error('Erreur lors de l\'import:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de l\'import du rapport de paiement';
      showAlert('Erreur', errorMessage, 'error');
    } finally {
      setImporting(false);
    }
  };

  const columns: Column[] = [
    {
      key: 'prestataireId',
      label: t('common.id'),
      sortable: true,
    },
    {
      key: 'provinceId',
      label: t('common.province'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => prestataire.provinceId || prestataire.province_id || 'N/A',
    },
    {
      key: 'zoneId',
      label: t('common.zone'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => prestataire.zoneId || prestataire.zone_id || 'N/A',
    },
    {
      key: 'aireId',
      label: t('common.area'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => prestataire.aireId || prestataire.aire_id || 'N/A',
    },
    {
      key: 'nom',
      label: t('common.name'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        // Chercher dans plusieurs emplacements possibles (comme dans MCZ page)
        const rawData = prestataire.raw_data || {};
        
        // Prénom
        const prenom = prestataire.prenom || prestataire.given_name_i_c || prestataire.Prenom || prestataire.Prénom || 
                       prestataire.firstName || prestataire.prenom_complet ||
                       rawData.prenom || rawData.given_name_i_c || rawData.Prenom || rawData.Prénom || 
                       rawData.firstName || rawData.prenom_complet || '';
        
        // Nom
        const nom = prestataire.nom || prestataire.family_name_i_c || prestataire.Nom || prestataire.family_name || 
                    prestataire.name || rawData.nom || rawData.family_name_i_c || rawData.Nom || 
                    rawData.family_name || rawData.name || '';
        
        // Postnom
        const postnom = prestataire.postnom || prestataire.middle_name_i_c || prestataire.Postnom || prestataire.post_nom || 
                        prestataire.lastName || prestataire.postnom_complet ||
                        rawData.postnom || rawData.middle_name_i_c || rawData.Postnom || rawData.post_nom || 
                        rawData.lastName || rawData.postnom_complet || '';
        
        // Nom complet
        const fullName = prestataire.nom_complet || prestataire.fullName || prestataire.full_name ||
                         rawData.nom_complet || rawData.fullName || rawData.full_name;
        
        if (fullName) return fullName;
        
        // Construire le nom complet depuis les parties
        const finalPrenom = prenom;
        const finalNom = nom;
        const finalPostnom = postnom;
        const parts = [finalPrenom, finalNom, finalPostnom].filter(p => p && String(p).trim() && p !== 'null' && p !== 'undefined');
        return parts.length > 0 ? parts.join(' ') : 'N/A';
      },
    },
    {
      key: 'gender',
      label: t('common.gender'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
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
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        // Chercher dans plusieurs emplacements possibles (comme dans MCZ page)
        const rawData = prestataire.raw_data || {};
        
        const telephone = prestataire.num_phone || 
                          prestataire.confirm_phone ||
                          prestataire.telephone || 
                          prestataire.Telephone ||
                          prestataire.phone ||
                          prestataire.Phone ||
                          prestataire.numero_telephone ||
                          prestataire.telephone_number ||
                          prestataire.contact ||
                          prestataire.numero ||
                          rawData.num_phone ||
                          rawData.confirm_phone ||
                          rawData.telephone ||
                          rawData.Telephone ||
                          rawData.phone ||
                          rawData.Phone ||
                          rawData.numero_telephone ||
                          rawData.telephone_number ||
                          rawData.contact ||
                          rawData.numero;
        
        return telephone && String(telephone).trim() && telephone !== 'null' && telephone !== 'undefined' 
               ? String(telephone).trim() 
               : 'N/A';
      },
    },
    {
      key: 'categorie',
      label: t('common.role'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const categorie = prestataire.categorie || prestataire.role || prestataire.campaign_role || prestataire.campaign_role_i_f || 'N/A';
        return categorie;
      },
    },
    {
      key: 'kycStatus',
      label: t('partner.kycStatus'),
      render: (value: any, prestataire: PrestataireForPartner) => {
        const kycStatus = prestataire.kycStatus || prestataire.kyc_status;
        if (!kycStatus) return <span className="text-gray-500">{t('partner.notVerified')}</span>;
        
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
      },
    },
    {
      key: 'validationStatus',
      label: t('partner.validationStatus'),
      render: (value: any, prestataire: PrestataireForPartner) => {
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
      label: t('partner.validationDate'),
      render: (value: any, prestataire: PrestataireForPartner) => getValidationDate(prestataire),
    },
    {
      key: 'approvalStatus',
      label: t('partner.approvalStatus'),
      render: (value: any, prestataire: PrestataireForPartner) => getStatusBadge(prestataire.approvalStatus || prestataire.status),
    },
    {
      key: 'approvalDate',
      label: t('partner.approvalDate'),
      render: (value: any, prestataire: PrestataireForPartner) => getApprovalDate(prestataire),
    },
    {
      key: 'presenceDays',
      label: t('partner.presenceDays'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const days = prestataire.presenceDays || prestataire.presence_days || prestataire.presence || 0;
        return days || 'N/A';
      },
    },
    {
      key: 'amountToPay',
      label: t('partner.amountToPay'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        // Montant calculé (pas le montant payé)
        const amount = prestataire.amountToPay || prestataire.amount_to_pay || 0;
        if (amount <= 0) return 'N/A';
        
        // Déterminer la devise à afficher
        const currency = prestataire.amountCurrency || 'USD';
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
      key: 'paymentStatus',
      label: t('partner.paymentStatus'),
      render: (value: any, prestataire: PrestataireForPartner) => getPaymentStatusBadge(prestataire.paymentStatus || prestataire.payment_status),
    },
    {
      key: 'paymentAmount',
      label: t('common.paidAmount'),
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => getPaymentAmount(prestataire),
    },
    {
      key: 'paymentDate',
      label: t('partner.paymentDate'),
      render: (value: any, prestataire: PrestataireForPartner) => getPaymentDate(prestataire),
    },
  ];

  if (user?.role !== 'PARTNER') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('partner.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('partner.subtitle')}
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campagne
            </label>
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
              Formulaire
            </label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Tous les formulaires</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Province
            </label>
            <select
              value={selectedProvinceId}
              onChange={(e) => {
                setSelectedProvinceId(e.target.value);
                setSelectedZoneId('');
                setSelectedAireId('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Toutes les provinces</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name || province.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zone de Santé
            </label>
            <select
              value={selectedZoneId}
              onChange={(e) => {
                setSelectedZoneId(e.target.value);
                setSelectedAireId('');
              }}
              disabled={!selectedProvinceId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Toutes les zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name || zone.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aire de Santé
            </label>
            <select
              value={selectedAireId}
              onChange={(e) => setSelectedAireId(e.target.value)}
              disabled={!selectedZoneId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Toutes les aires</option>
              {aires.map((aire) => (
                <option key={aire.id} value={aire.id}>
                  {aire.name || aire.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rôle/Catégorie
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
            >
              <option value="">Tous les rôles</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-500">Chargement...</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* En-tête avec titre et boutons */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              Tableau ({prestataires.length})
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCalculateAmountModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Calculer le montant
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importer rapport de paiement
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('partner.export')}
                </button>
                
                {showExportMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                      <div className="py-1">
                        <button
                          onClick={() => handleExport('csv')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          CSV
                        </button>
                        <button
                          onClick={() => handleExport('excel')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Excel (XLSX)
                        </button>
                        <button
                          onClick={() => handleExport('pdf')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => handleExport('image')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Image (PNG)
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div ref={tableRef}>
            <DataTable
              data={prestataires}
              columns={columns}
              exportFilename="prestataires-approuves"
              hideHeader={true}
            />
          </div>
        </div>
      )}

      {/* Modal d'import */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#111827' }}>Importer un rapport de paiement</h2>
            <p className="text-sm mb-4" style={{ color: '#374151' }}>
              Format CSV ou Excel attendu: prestataireId,status,paymentDate,transactionId,paymentReference,paymentAmount
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#111827' }}>
                Fichier à importer
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="payment-file-input"
                  />
                  <div className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white text-center cursor-pointer">
                    <span className="text-sm" style={{ color: '#374151' }}>
                      {importFile ? importFile.name : 'Choisir un fichier'}
                    </span>
                  </div>
                </label>
                {importFile && (
                  <button
                    onClick={() => setImportFile(null)}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
                style={{ color: '#374151' }}
                disabled={importing}
              >
                Annuler
              </button>
              <button
                onClick={handleImportPaymentReport}
                disabled={!importFile || importing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:text-white"
              >
                {importing ? 'Importation...' : 'Importer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de calcul de montant */}
      {showCalculateAmountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#111827' }}>
              Calculer le montant à payer
            </h2>
            <p className="text-sm mb-4" style={{ color: '#374151' }}>
              Définissez les règles de tarification par rôle. Le montant sera calculé automatiquement pour tous les prestataires ayant le même rôle (Montant = Nombre de jours × Montant unitaire).
            </p>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium" style={{ color: '#111827' }}>Règles de tarification :</h3>
                <button
                  onClick={handleAddRateRule}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + Ajouter une règle
                </button>
              </div>
              
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3" style={{ color: '#111827' }}>Rôle/Catégorie</th>
                      <th className="text-left p-3" style={{ color: '#111827' }}>Currency</th>
                      <th className="text-left p-3" style={{ color: '#111827' }}>Montant unitaire</th>
                      <th className="text-left p-3" style={{ color: '#111827' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateRules.map((rule, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3">
                          <select
                            value={rule.role}
                            onChange={(e) => handleUpdateRateRule(index, 'role', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                          >
                            <option value="">Sélectionner un rôle</option>
                            {availableCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={rule.currency}
                            onChange={(e) => handleUpdateRateRule(index, 'currency', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                          >
                            <option value="USD">USD (Dollars)</option>
                            <option value="CDF">CDF (Francs congolais)</option>
                            <option value="EURO">EURO</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rule.rate || ''}
                            onChange={(e) => handleUpdateRateRule(index, 'rate', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                          />
                        </td>
                        <td className="p-3">
                          {rateRules.length > 1 && (
                            <button
                              onClick={() => handleRemoveRateRule(index)}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-medium mb-3" style={{ color: '#111827' }}>
                Aperçu des calculs ({(() => {
                  // Log pour déboguer l'aperçu
                  const validRules = rateRules.filter(rule => rule.role && rule.currency && rule.rate > 0);
                  console.log('[Aperçu] Règles valides:', validRules);
                  console.log('[Aperçu] Nombre de prestataires:', prestataires.length);
                  
                  const matchingPrestataires = prestataires.filter((p, index) => {
                    const days = p.presenceDays || p.presence_days || 0;
                    if (days === 0) {
                      if (index < 3) console.log(`[Aperçu] Prestataire ${p.prestataireId || p.id}: pas de jours (${days})`);
                      return false;
                    }
                    
                    const prestataireRole = extractRole(p, index < 3);
                    if (!prestataireRole) {
                      if (index < 3) console.log(`[Aperçu] Prestataire ${p.prestataireId || p.id}: pas de rôle extrait`);
                      return false;
                    }
                    
                    if (index < 3) {
                      console.log(`[Aperçu] Prestataire ${p.prestataireId || p.id}: rôle="${prestataireRole}", jours=${days}`);
                    }
                    
                    const matches = validRules.some(rule => {
                      const normalizedRuleRole = normalizeText(rule.role);
                      const exactMatch = prestataireRole === normalizedRuleRole;
                      const partialMatch1 = prestataireRole.includes(normalizedRuleRole);
                      const partialMatch2 = normalizedRuleRole.includes(prestataireRole);
                      const matches = exactMatch || partialMatch1 || partialMatch2;
                      
                      if (index < 3 && matches) {
                        console.log(`[Aperçu] ✓ Correspondance trouvée: "${prestataireRole}" vs "${normalizedRuleRole}" (règle: "${rule.role}")`);
                      }
                      
                      return matches;
                    });
                    
                    if (index < 3 && !matches) {
                      console.log(`[Aperçu] ✗ Aucune correspondance pour "${prestataireRole}". Règles disponibles:`, validRules.map(r => normalizeText(r.role)));
                    }
                    
                    return matches;
                  });
                  
                  console.log(`[Aperçu] Prestataires correspondants: ${matchingPrestataires.length}`);
                  return matchingPrestataires.length;
                })()} prestataires concernés)
              </h3>
              <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2" style={{ color: '#111827' }}>Nom</th>
                      <th className="text-left p-2" style={{ color: '#111827' }}>Rôle</th>
                      <th className="text-left p-2" style={{ color: '#111827' }}>Jours</th>
                      <th className="text-left p-2" style={{ color: '#111827' }}>Tarif unitaire</th>
                      <th className="text-left p-2" style={{ color: '#111827' }}>Montant calculé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Créer le map des règles normalisées une seule fois (optimisation)
                      const validRules = rateRules.filter(rule => rule.role && rule.currency && rule.rate > 0);
                      const rateMap = new Map<string, typeof validRules[0]>();
                      validRules.forEach(rule => {
                        const normalizedRuleRole = normalizeText(rule.role);
                        rateMap.set(normalizedRuleRole, rule);
                      });
                      
                      return prestataires.map((p) => {
                        const days = p.presenceDays || p.presence_days || 0;
                        if (days === 0) return null;
                        
                        const prestataireRole = extractRole(p);
                        if (!prestataireRole) return null;
                        
                        // Recherche exacte d'abord
                        let matchedRule = rateMap.get(prestataireRole);
                        
                        // Si pas trouvé, recherche partielle
                        if (!matchedRule) {
                          const rateEntries = Array.from(rateMap.entries());
                          for (const [normalizedRuleRole, rule] of rateEntries) {
                            if (prestataireRole.includes(normalizedRuleRole) || normalizedRuleRole.includes(prestataireRole)) {
                              matchedRule = rule;
                              break;
                            }
                          }
                        }

                        if (!matchedRule) return null;

                        const calculatedAmount = days * matchedRule.rate;
                        const currencySymbol = matchedRule.currency === 'USD' ? '$' : matchedRule.currency === 'CDF' ? 'FC' : '€';
                        
                        // Afficher le rôle original (pas normalisé) pour l'affichage
                        const displayRole = p.categorie || p.role || p.campaign_role_i_f || p.campaign_role || prestataireRole || 'N/A';
                        
                        return (
                          <tr key={p.id} className="border-b">
                            <td className="p-2" style={{ color: '#374151' }}>
                              {p.nom || p.nom_complet || (p.prenom && p.postnom ? `${p.prenom} ${p.postnom}` : p.prenom) || 'N/A'}
                            </td>
                            <td className="p-2" style={{ color: '#374151' }}>{displayRole}</td>
                            <td className="p-2" style={{ color: '#374151' }}>{days}</td>
                            <td className="p-2" style={{ color: '#374151' }}>{matchedRule.rate} {currencySymbol}</td>
                            <td className="p-2 font-medium" style={{ color: '#111827' }}>
                              {calculatedAmount > 0 ? `${calculatedAmount} ${currencySymbol}` : 'N/A'}
                            </td>
                          </tr>
                        );
                      }).filter(Boolean);
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowCalculateAmountModal(false);
                  setRateRules([{ role: '', currency: 'USD', rate: 0 }]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
                style={{ color: '#374151' }}
                disabled={calculating}
              >
                Annuler
              </button>
              <button
                onClick={handleCalculateAmount}
                disabled={calculating || rateRules.filter(r => r.role && r.currency && r.rate > 0).length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:text-white"
              >
                {calculating ? 'Calcul en cours...' : 'Calculer et enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
