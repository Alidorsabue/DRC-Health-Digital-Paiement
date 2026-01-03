'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { approvalsApi, PrestataireForApproval } from '../../../lib/api/approvals';
import { campaignsApi } from '../../../lib/api/campaigns';
import { formsApi } from '../../../lib/api/forms';
import { statsApi, ZoneStats } from '../../../lib/api/stats';
import { geographicApi } from '../../../lib/api/geographic';
import { Campaign, Form } from '../../../types';
import AlertModal from '../../../components/Modal/AlertModal';
import DataTable, { Column } from '../../../components/DataTable';
import { getErrorMessage } from '../../../utils/error-handler';
import StatCardGroup, { StatCard } from '../../../components/Statistics/StatCardGroup';
import { useTranslation } from '../../../hooks/useTranslation';

interface GeographicOption {
  id: string;
  name: string;
}

export default function MCZPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<ZoneStats | null>(null);
  const [prestataires, setPrestataires] = useState<PrestataireForApproval[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [aires, setAires] = useState<GeographicOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedAireId, setSelectedAireId] = useState<string>('');
  const [selectedPrestataires, setSelectedPrestataires] = useState<Set<string>>(new Set());
  const [batchComment, setBatchComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

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

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadCampaigns = async () => {
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
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadForms = async () => {
    try {
      const data = await formsApi.getAll();
      setForms(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des formulaires:', error);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadAires = async (zoneId: string) => {
    if (!zoneId) {
      setAires([]);
      return;
    }
    
    try {
      console.log('MCZ: Chargement des aires pour zone:', zoneId);
      // Récupérer les aires depuis l'API géographique
      const airesFromGeo = await geographicApi.getAires(zoneId);
      console.log('MCZ: Aires depuis API géographique:', airesFromGeo.length, airesFromGeo);
      
      // Récupérer les aires depuis les données (tables form_*)
      let airesFromData: { id: string; name: string }[] = [];
      try {
        airesFromData = await statsApi.getAiresFromData(zoneId);
        console.log('MCZ: Aires depuis les données:', airesFromData.length, airesFromData);
      } catch (error) {
        console.warn('MCZ: Impossible de récupérer les aires depuis les données:', error);
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
      console.log('MCZ: Aires combinées:', allAires.length, allAires);
      setAires(allAires);
    } catch (error: any) {
      console.error('MCZ: Erreur lors du chargement des aires:', error);
      setAires([]);
    }
  };

  // SUPPRIMÉ useCallback pour éviter les problèmes de hooks React #310
  const loadStats = async () => {
    if (!user?.zoneId) return;
    
    setLoadingStats(true);
    try {
      const filters: any = {};
      if (selectedCampaignId) filters.campaignId = selectedCampaignId;
      if (selectedFormId) filters.formId = selectedFormId;
      const data = await statsApi.getZone(user.zoneId, filters);
      setStats(data);
    } catch (error: any) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'MCZ' && user?.zoneId) {
      loadCampaigns();
      loadForms();
      loadAires(user.zoneId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.zoneId]);

  useEffect(() => {
    if (user?.role === 'MCZ' && user?.zoneId) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.zoneId, selectedCampaignId, selectedFormId]);

  useEffect(() => {
    if (selectedFormId && user?.role === 'MCZ' && user?.zoneId) {
      loadPrestataires();
    } else if (user?.role === 'MCZ' && !user?.zoneId) {
      showAlert('Configuration', 'Votre zone de santé n\'est pas configurée. Contactez un administrateur.', 'warning');
    }
  }, [selectedFormId, filterStatus, selectedAireId, user]);

  useEffect(() => {
    if (selectedCampaignId && campaigns.length > 0) {
      const campaign = campaigns.find(c => c.id === selectedCampaignId);
      if (campaign?.enregistrementFormId) {
        setSelectedFormId(campaign.enregistrementFormId);
      }
    }
  }, [selectedCampaignId, campaigns]);

  const loadPrestataires = async () => {
    if (!selectedFormId || !user?.zoneId) {
      console.warn('loadPrestataires: formId ou zoneId manquant', {
        selectedFormId,
        zoneId: user?.zoneId,
      });
      setPrestataires([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      console.log('=== CHARGEMENT PRESTATAIRES ===');
      console.log('Paramètres:', {
        formId: selectedFormId,
        zoneId: user.zoneId,
        filterStatus,
        userRole: user?.role,
      });
      
      // Le backend filtre automatiquement pour MCZ : seuls les prestataires validés par IT sont retournés
      // Le filtrage par statut (Validés par IT, Approuvés, Rejetés) se fait ensuite côté frontend
      const data = await approvalsApi.getPrestatairesForApproval(
        selectedFormId,
        user.zoneId,
        undefined, // Le backend gère automatiquement le filtrage pour MCZ
      );
      
      console.log('Prestataires reçus du backend:', data.length, data);
      
      // Afficher la répartition par zoneId pour le débogage
      const zoneIdCount = data.reduce((acc: any, p: any) => {
        const zoneId = p.zoneId || p.zone_id || 'null';
        acc[zoneId] = (acc[zoneId] || 0) + 1;
        return acc;
      }, {});
      console.log('Répartition par zoneId:', zoneIdCount);
      console.log('ZoneId de l\'utilisateur:', user.zoneId);
      console.log('Exemples de zoneId dans les données:', data.slice(0, 5).map(p => ({
        id: p.id,
        zoneId: p.zoneId,
        zone_id: p.zone_id,
        allZoneFields: Object.keys(p).filter(k => k.toLowerCase().includes('zone')),
      })));
      
      // Afficher la répartition par statut pour le débogage
      const statusCount = data.reduce((acc: any, p: any) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});
      console.log('Répartition par statut:', statusCount);
      console.log('Répartition par approvalStatus:', data.reduce((acc: any, p: any) => {
        const key = p.approvalStatus || 'null';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}));
      
      // Filtrer selon le statut sélectionné côté frontend
      // Les prestataires approuvés/rejetés doivent rester visibles avec leur nouveau statut
      let filtered = data;
      
      // Fonction pour normaliser les zoneId (enlever espaces, convertir en minuscules, etc.)
      const normalizeZoneId = (zoneId: string | null | undefined): string => {
        if (!zoneId) return '';
        return String(zoneId).trim().toLowerCase();
      };
      
      const userZoneIdNormalized = normalizeZoneId(user.zoneId);
      console.log('ZoneId utilisateur normalisé:', userZoneIdNormalized);
      
      // Sécurité: Filtrer par zone de santé de l'utilisateur (ne devrait jamais être nécessaire si le backend filtre correctement)
      // Mais on le fait quand même pour garantir que seules les données de la zone sont affichées
      // Comparaison normalisée pour gérer les différences de format
      filtered = filtered.filter(p => {
        const pZoneId = p.zoneId || p.zone_id || p.zone_de_sante_id || p.zoneDeSanteId;
        const pZoneIdNormalized = normalizeZoneId(pZoneId);
        
        // Comparaison normalisée
        const matches = pZoneIdNormalized === userZoneIdNormalized;
        
        if (!matches && pZoneId) {
          console.warn(`ZoneId mismatch: prestataire zoneId="${pZoneId}" (normalisé: "${pZoneIdNormalized}") !== user zoneId="${user.zoneId}" (normalisé: "${userZoneIdNormalized}")`);
        }
        
        return matches;
      });
      
      console.log(`Après filtrage par zoneId: ${filtered.length} prestataires (sur ${data.length} reçus)`);
      
      // Filtrer par aire de santé si sélectionnée
      if (selectedAireId) {
        filtered = filtered.filter(p => 
          (p.aireId === selectedAireId || p.aire_id === selectedAireId)
        );
      }
      
      // Filtrer par statut
      if (!filterStatus || filterStatus === '') {
        // Afficher TOUS les prestataires (de la zone et de l'aire si sélectionnée)
        filtered = filtered;
      } else if (filterStatus === 'VALIDE_PAR_IT') {
        // Afficher ceux validés par IT qui ne sont pas encore approuvés/rejetés
        filtered = filtered.filter(p => 
          (p.status === 'VALIDE_PAR_IT' || p.status === 'EN_ATTENTE_PAR_MCZ') &&
          (!p.approvalStatus || p.approvalStatus === null)
        );
      } else if (filterStatus === 'APPROUVE_PAR_MCZ') {
        // Afficher seulement les approuvés
        filtered = filtered.filter(p => 
          p.approvalStatus === 'APPROVED' || 
          p.status === 'APPROUVE_PAR_MCZ'
        );
      } else if (filterStatus === 'REJETE_PAR_MCZ') {
        // Afficher seulement les rejetés
        filtered = filtered.filter(p => 
          p.approvalStatus === 'REJECTED' || 
          p.status === 'REJETE_PAR_MCZ'
        );
      }
      
      console.log('=== RÉSULTATS DU FILTRAGE ===');
      console.log(`Total reçu du backend: ${data.length}`);
      console.log(`Après filtrage frontend (${filterStatus}): ${filtered.length}`);
      
      if (filtered.length === 0 && data.length > 0) {
        console.warn('⚠️ ATTENTION: Des données ont été reçues mais filtrées à zéro!');
        console.warn('Données reçues (premiers 3):', data.slice(0, 3).map(p => ({
          id: p.id,
          status: p.status,
          approvalStatus: p.approvalStatus,
          zoneId: p.zoneId,
        })));
      }
      
      if (data.length === 0) {
        console.warn('⚠️ ATTENTION: Aucune donnée reçue du backend!');
        console.warn('Vérifiez que:');
        console.warn('  1. Le formulaire existe et contient des données');
        console.warn('  2. La zoneId correspond bien aux données');
        console.warn('  3. Les prestataires ont bien le zoneId dans leurs données');
      }
      
      console.log('Détails des prestataires filtrés:', filtered.slice(0, 5).map(p => ({
        id: p.id,
        status: p.status,
        approvalStatus: p.approvalStatus,
        kycStatus: p.kycStatus || p.kyc_status,
        zoneId: p.zoneId,
        nom: p.nom || p.family_name_i_c || 'N/A',
        prenom: p.prenom || p.given_name_i_c || 'N/A',
      })));
      
      setPrestataires(filtered);
    } catch (error: any) {
      console.error('Erreur lors du chargement des prestataires:', error);
      // Utiliser la fonction utilitaire pour obtenir le message d'erreur formaté avec solutions
      const errorMsg = getErrorMessage(error, 'Erreur inconnue');
      showAlert('Erreur', `Impossible de charger les prestataires:\n\n${errorMsg}`, 'error');
      setPrestataires([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (prestataireId: string) => {
    try {
      await approvalsApi.approve(prestataireId, undefined, selectedFormId);
      showAlert('Succès', 'Prestataire approuvé avec succès', 'success');
      loadPrestataires();
      setSelectedPrestataires(new Set());
    } catch (error: any) {
      console.error('Erreur lors de l\'approbation:', error);
      showAlert('Erreur', error.response?.data?.message || 'Impossible d\'approuver le prestataire', 'error');
    }
  };

  const handleReject = async (prestataireId: string, commentaire: string) => {
    if (!commentaire.trim()) {
      showAlert('Erreur', 'Un commentaire est obligatoire pour le rejet', 'warning');
      return;
    }
    try {
      await approvalsApi.reject(prestataireId, commentaire, selectedFormId);
      showAlert('Succès', 'Prestataire rejeté avec succès', 'success');
      loadPrestataires();
      setRejectComment('');
      setRejectingId(null);
      setShowRejectModal(false);
      setSelectedPrestataires(new Set());
    } catch (error: any) {
      console.error('Erreur lors du rejet:', error);
      showAlert('Erreur', error.response?.data?.message || 'Impossible de rejeter le prestataire', 'error');
    }
  };

  const handleBatchApprove = async () => {
    if (selectedPrestataires.size === 0) {
      showAlert('Attention', 'Veuillez sélectionner au moins un prestataire', 'warning');
      return;
    }
    if (!selectedFormId) {
      showAlert('Erreur', 'Veuillez sélectionner un formulaire', 'warning');
      return;
    }
    try {
      await approvalsApi.approveBatch(
        Array.from(selectedPrestataires),
        batchComment || undefined,
        selectedFormId,
      );
      showAlert('Succès', `${selectedPrestataires.size} prestataire(s) approuvé(s) avec succès`, 'success');
      loadPrestataires();
      setSelectedPrestataires(new Set());
      setBatchComment('');
    } catch (error: any) {
      console.error('Erreur lors de l\'approbation batch:', error);
      showAlert('Erreur', error.response?.data?.message || 'Impossible d\'approuver les prestataires', 'error');
    }
  };

  const handleBatchReject = async () => {
    if (selectedPrestataires.size === 0) {
      showAlert('Attention', 'Veuillez sélectionner au moins un prestataire', 'warning');
      return;
    }
    if (!batchComment.trim()) {
      showAlert('Erreur', 'Un commentaire est obligatoire pour le rejet', 'warning');
      return;
    }
    if (!selectedFormId) {
      showAlert('Erreur', 'Veuillez sélectionner un formulaire', 'warning');
      return;
    }
    try {
      await approvalsApi.rejectBatch(
        Array.from(selectedPrestataires),
        batchComment,
        selectedFormId,
      );
      showAlert('Succès', `${selectedPrestataires.size} prestataire(s) rejeté(s) avec succès`, 'success');
      loadPrestataires();
      setSelectedPrestataires(new Set());
      setBatchComment('');
    } catch (error: any) {
      console.error('Erreur lors du rejet batch:', error);
      showAlert('Erreur', error.response?.data?.message || 'Impossible de rejeter les prestataires', 'error');
    }
  };

  const toggleSelectPrestataire = (id: string) => {
    const newSet = new Set(selectedPrestataires);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPrestataires(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedPrestataires.size === prestataires.length) {
      setSelectedPrestataires(new Set());
    } else {
      setSelectedPrestataires(new Set(prestataires.map(p => p.id)));
    }
  };

  const getStatusBadge = (prestataire: PrestataireForApproval) => {
    const isApproved = prestataire.approvalStatus === 'APPROVED' || prestataire.status === 'APPROUVE_PAR_MCZ';
    const isRejected = prestataire.approvalStatus === 'REJECTED' || prestataire.status === 'REJETE_PAR_MCZ';
    
    if (isApproved) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          {t('mcz.approved')}
        </span>
      );
    } else if (isRejected) {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          {t('mcz.rejected')}
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          {t('common.pending')}
        </span>
      );
    }
  };

  const getPaymentStatusBadge = (prestataire: PrestataireForApproval) => {
    // Chercher dans plusieurs emplacements possibles
    const rawData = prestataire.raw_data || {};
    const status = prestataire.paymentStatus || 
                   prestataire.payment_status || 
                   rawData.paymentStatus || 
                   rawData.payment_status ||
                   (prestataire as any).paymentStatus ||
                   (prestataire as any).payment_status ||
                   'PENDING';
    
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

  const getKycStatusBadge = (prestataire: PrestataireForApproval) => {
    // Chercher dans plusieurs emplacements possibles
    const rawData = prestataire.raw_data || {};
    const kycStatus = prestataire.kycStatus || 
                     prestataire.kyc_status || 
                     rawData.kycStatus || 
                     rawData.kyc_status ||
                     (prestataire as any).kycStatus ||
                     (prestataire as any).kyc_status;
    
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

  const getValidationDate = (prestataire: PrestataireForApproval): string => {
    // Chercher dans plusieurs emplacements possibles
    // Le backend retourne validation_date directement sur l'objet (pas dans raw_data car exclu)
    const rawData = prestataire.raw_data || {};
    
    // Chercher d'abord directement sur l'objet (les champs du formulaire peuvent être au niveau racine)
    const validationDate = prestataire.validation_date ||  // Format snake_case depuis le backend
                          prestataire.validationDate ||    // Format camelCase
                          prestataire.validated_at ||      // Autre format possible
                          rawData.validation_date ||       // Dans raw_data si présent
                          rawData.validationDate ||        // Dans raw_data camelCase
                          rawData.validated_at ||          // Dans raw_data autre format
                          (prestataire as any).validation_date; // Cast pour TypeScript
    
    return formatDate(validationDate);
  };

  const getApprovalDate = (prestataire: PrestataireForApproval): string => {
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
  const getValidationStatus = (prestataire: PrestataireForApproval): string => {
    const rawData = prestataire.raw_data || {};
    // Chercher validation_status dans raw_data ou directement sur l'objet
    const validationStatus = (prestataire as any).validation_status ||
                            rawData.validation_status ||
                            (prestataire as any).validationStatus ||
                            rawData.validationStatus ||
                            'ENREGISTRE';
    
    return validationStatus;
  };

  // Fonction helper pour récupérer le montant payé
  const getPaymentAmount = (prestataire: PrestataireForApproval): number => {
    const rawData = prestataire.raw_data || {};
    const paymentAmount = prestataire.paymentAmount ||
                         prestataire.payment_amount ||
                         rawData.paymentAmount ||
                         rawData.payment_amount ||
                         0;
    return paymentAmount;
  };

  const getPaymentDate = (prestataire: PrestataireForApproval): string => {
    // Chercher dans plusieurs emplacements possibles
    const rawData = prestataire.raw_data || {};
    const paymentDate = prestataire.paymentDate || 
                        prestataire.payment_date || 
                        prestataire.paid_at ||
                        rawData.paymentDate || 
                        rawData.payment_date ||
                        rawData.paid_at ||
                        (prestataire as any).paymentDate ||
                        (prestataire as any).payment_date ||
                        (prestataire as any).paid_at;
    
    return formatDate(paymentDate);
  };

  if (user?.role !== 'MCZ') {
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
          {t('mcz.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {t('mcz.zone')}: {user.zoneId || t('mcz.notDefined')}
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
            progress={stats.total > 0 ? 100 : 0}
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
      )}

      {/* Filtres */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Campagne
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
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
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Formulaire
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Aires de Santé {aires.length > 0 && `(${aires.length})`}
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
              value={selectedAireId}
              onChange={(e) => setSelectedAireId(e.target.value)}
            >
              <option value="">Toutes les aires</option>
              {aires.length === 0 ? (
                <option value="" disabled>
                  Aucune aire disponible
                </option>
              ) : (
                aires.map((aire) => (
                  <option key={aire.id} value={aire.id}>
                    {aire.name || aire.id}
                  </option>
                ))
              )}
            </select>
            {aires.length === 0 && user?.zoneId && (
              <p className="text-xs text-gray-500 mt-1">
                Chargement des aires pour {user.zoneId}...
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Statut
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="VALIDE_PAR_IT">Validés par IT (en attente)</option>
              <option value="APPROUVE_PAR_MCZ">Approuvés</option>
              <option value="REJETE_PAR_MCZ">Rejetés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions batch */}
      {selectedPrestataires.size > 0 && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {selectedPrestataires.size} prestataire(s) sélectionné(s)
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Commentaire (optionnel)"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={batchComment}
                onChange={(e) => setBatchComment(e.target.value)}
              />
              <button
                onClick={handleBatchApprove}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium"
              >
                Approuver en lot
              </button>
              <button
                onClick={handleBatchReject}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Rejeter en lot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des prestataires */}
      {!selectedFormId ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-2">Sélectionnez une campagne ou un formulaire pour voir les prestataires</p>
          <p className="text-sm text-gray-400">Les prestataires validés par IT de votre zone apparaîtront ici</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Chargement des prestataires...</p>
        </div>
      ) : prestataires.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Aucun prestataire trouvé</p>
          <p className="text-sm text-gray-400 mt-2">
            {!filterStatus || filterStatus === ''
              ? 'Aucun prestataire dans votre zone pour ce formulaire'
              : filterStatus === 'VALIDE_PAR_IT'
              ? 'Aucun prestataire validé par IT (en attente) dans votre zone pour ce formulaire'
              : `Aucun prestataire avec le statut sélectionné dans votre zone`}
          </p>
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
              key: 'zoneId',
              label: t('mcz.zone'),
              render: (_, prestataire) => prestataire.zoneId || prestataire.zone_id || user.zoneId || 'N/A',
            },
            {
              key: 'aireId',
              label: t('mcz.healthArea'),
              render: (_, prestataire) => prestataire.aireId || prestataire.aire_id || 'N/A',
            },
            {
              key: 'nom',
              label: t('mcz.fullName'),
              render: (_, prestataire) => {
                const prenom = prestataire.given_name_i_c || prestataire.prenom || prestataire.Prenom || prestataire.Prénom || '';
                const nom = prestataire.family_name_i_c || prestataire.nom || prestataire.Nom || '';
                const postnom = prestataire.middle_name_i_c || prestataire.postnom || prestataire.Postnom || prestataire.post_nom || '';
                const rawData = prestataire.raw_data || {};
                const prenomRaw = rawData.given_name_i_c || rawData.prenom || rawData.Prenom || rawData.Prénom || '';
                const nomRaw = rawData.family_name_i_c || rawData.nom || rawData.Nom || '';
                const postnomRaw = rawData.middle_name_i_c || rawData.postnom || rawData.Postnom || rawData.post_nom || '';
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
              label: t('mcz.phone'),
              render: (_, prestataire) => {
                const telephone = prestataire.num_phone || 
                                prestataire.confirm_phone || 
                                prestataire.telephone || 
                                prestataire.Telephone ||
                                prestataire.phone ||
                                prestataire.Phone;
                const rawData = prestataire.raw_data || {};
                const telephoneRaw = rawData.num_phone || 
                                    rawData.confirm_phone || 
                                    rawData.telephone || 
                                    rawData.Telephone ||
                                    rawData.phone ||
                                    rawData.Phone;
                return telephone || telephoneRaw || 'N/A';
              },
            },
            {
              key: 'categorie',
              label: t('mcz.role'),
              render: (_, prestataire) => {
                const role = prestataire.categorie || 
                            prestataire.campaign_role_i_f || 
                            prestataire.campaign_role ||
                            prestataire.role ||
                            prestataire.role_prestataire;
                const rawData = prestataire.raw_data || {};
                const roleRaw = rawData.categorie || 
                               rawData.campaign_role_i_f || 
                               rawData.campaign_role ||
                               rawData.role ||
                               rawData.role_prestataire;
                return role || roleRaw || 'N/A';
              },
            },
            {
              key: 'kycStatus',
              label: t('mcz.kycStatus'),
              render: (_, prestataire) => getKycStatusBadge(prestataire),
            },
            {
              key: 'validationStatus',
              label: t('mcz.validationStatus'),
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
              label: t('mcz.validationDate'),
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
              render: (_, prestataire) => getStatusBadge(prestataire),
            },
            {
              key: 'approvalDate',
              label: t('mcz.approvalDate'),
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
              label: t('mcz.paymentStatus'),
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
              label: t('mcz.paymentDate'),
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
          title="Prestataires"
          exportFilename="prestataires-mcz"
          selectable={true}
          selectedItems={selectedPrestataires}
          onSelectItem={toggleSelectPrestataire}
          onSelectAll={toggleSelectAll}
          isRowDisabled={(prestataire) => {
            const isApproved = prestataire.approvalStatus === 'APPROVED' || prestataire.status === 'APPROUVE_PAR_MCZ';
            const isRejected = prestataire.approvalStatus === 'REJECTED' || prestataire.status === 'REJETE_PAR_MCZ';
            return isApproved || isRejected;
          }}
          actions={(prestataire) => {
            const isApproved = prestataire.approvalStatus === 'APPROVED' || prestataire.status === 'APPROUVE_PAR_MCZ';
            const isRejected = prestataire.approvalStatus === 'REJECTED' || prestataire.status === 'REJETE_PAR_MCZ';
            
            if (!isApproved && !isRejected) {
              return (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(prestataire.id)}
                    className="text-green-600 hover:text-green-900 text-sm font-medium"
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(prestataire.id);
                      setShowRejectModal(true);
                    }}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Rejeter
                  </button>
                </div>
              );
            }
            return (
              <span className="text-gray-400 text-xs">
                {isApproved ? 'Approuvé' : 'Rejeté'}
              </span>
            );
          }}
        />
      )}

      {/* Modal de rejet */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Rejeter le prestataire
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Un commentaire est obligatoire pour expliquer le rejet.
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4"
                rows={4}
                placeholder="Commentaire de rejet..."
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectComment('');
                    setRejectingId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (rejectingId) {
                      handleReject(rejectingId, rejectComment);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Rejeter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />
    </div>
  );
}
