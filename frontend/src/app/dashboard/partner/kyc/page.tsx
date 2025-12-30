'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../../../../store/authStore';
import { partnersApi, PrestataireForPartner, KycReportRow } from '../../../../lib/api/partners';
import { campaignsApi } from '../../../../lib/api/campaigns';
import { formsApi } from '../../../../lib/api/forms';
import { geographicApi } from '../../../../lib/api/geographic';
import { Campaign, Form } from '../../../../types';
import AlertModal from '../../../../components/Modal/AlertModal';
import DataTable, { Column } from '../../../../components/DataTable';
import { exportData, ExportColumn, ExportRow } from '../../../../utils/export';
import * as XLSX from 'xlsx';

interface GeographicOption {
  id: string;
  name: string;
}

export default function KycVerificationPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [prestataires, setPrestataires] = useState<PrestataireForPartner[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [provinces, setProvinces] = useState<GeographicOption[]>([]);
  const [zones, setZones] = useState<GeographicOption[]>([]);
  const [aires, setAires] = useState<GeographicOption[]>([]);
  const [allZones, setAllZones] = useState<Map<string, GeographicOption>>(new Map());
  const [allAires, setAllAires] = useState<Map<string, GeographicOption>>(new Map());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedAireId, setSelectedAireId] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [showImportKycModal, setShowImportKycModal] = useState(false);
  const [importKycFile, setImportKycFile] = useState<File | null>(null);
  const [importKycFileName, setImportKycFileName] = useState<string>('');
  const [importingKyc, setImportingKyc] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
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
      // Sélectionner automatiquement la campagne active (formulaire en cours)
      setSelectedCampaignId((prev) => {
        if (!prev && data.length > 0) {
          const activeCampaign = data.find(c => c.isActive) || data[0];
          return activeCampaign.id;
        }
        return prev;
      });
    } catch (error) {
      console.error('Erreur lors du chargement des campagnes:', error);
    }
  }, []);

  const loadForms = useCallback(async () => {
    try {
      const data = await formsApi.getAll();
      const publishedForms = data.filter((form) => 
        form.versions?.some((v) => v.isPublished)
      );
      setForms(publishedForms);
    } catch (error) {
      console.error('Erreur lors du chargement des formulaires:', error);
    }
  }, []);

  const loadProvinces = useCallback(async () => {
    try {
      const data = await geographicApi.getProvinces();
      setProvinces(data);
    } catch (error) {
      console.error('Erreur lors du chargement des provinces:', error);
    }
  }, []);

  const loadZones = useCallback(async () => {
    if (!selectedProvinceId) {
      setZones([]);
      return;
    }
    try {
      const data = await geographicApi.getZones(selectedProvinceId);
      setZones(data);
    } catch (error) {
      console.error('Erreur lors du chargement des zones:', error);
    }
  }, [selectedProvinceId]);

  const loadAires = useCallback(async () => {
    if (!selectedZoneId) {
      setAires([]);
      return;
    }
    try {
      const data = await geographicApi.getAires(selectedZoneId);
      setAires(data);
    } catch (error) {
      console.error('Erreur lors du chargement des aires:', error);
    }
  }, [selectedZoneId]);

  const loadPrestataires = useCallback(async () => {
    try {
      setLoading(true);
      // Par défaut, charger tous les prestataires sans filtres
      // Les filtres sont optionnels et peuvent être appliqués par l'utilisateur
      const data = await partnersApi.getRegisteredPrestataires(
        selectedCampaignId || undefined, // Toutes les campagnes si vide
        selectedFormId || undefined, // Tous les formulaires si vide
        selectedCategory || undefined, // Toutes les catégories si vide
        selectedProvinceId || undefined, // Toutes les provinces si vide
        selectedZoneId || undefined, // Toutes les zones si vide
        selectedAireId || undefined, // Toutes les aires si vide
      );
      setPrestataires(data);

      // Extraire les catégories uniques
      const categories = new Set<string>();
      data.forEach((p) => {
        const cat = p.categorie || p.role || p.campaign_role || p.campaign_role_i_f;
        if (cat) categories.add(cat);
      });
      setAvailableCategories(Array.from(categories).sort());

      // Charger toutes les zones et aires nécessaires pour afficher les noms
      const uniqueProvinceIds = new Set<string>();
      const uniqueZoneIds = new Set<string>();
      
      data.forEach((p) => {
        const provinceId = p.provinceId || p.province_id;
        const zoneId = p.zoneId || p.zone_id;
        const aireId = p.aireId || p.aire_id;
        
        if (provinceId) uniqueProvinceIds.add(provinceId);
        if (zoneId) uniqueZoneIds.add(zoneId);
      });

      // Charger toutes les zones pour toutes les provinces
      const zonesMap = new Map<string, GeographicOption>();
      const provinceIdsArray = Array.from(uniqueProvinceIds);
      for (const provinceId of provinceIdsArray) {
        try {
          const zonesData = await geographicApi.getZones(provinceId);
          zonesData.forEach(zone => {
            zonesMap.set(zone.id, zone);
          });
        } catch (error) {
          console.error(`Erreur lors du chargement des zones pour la province ${provinceId}:`, error);
        }
      }
      setAllZones(zonesMap);

      // Charger toutes les aires pour toutes les zones
      const airesMap = new Map<string, GeographicOption>();
      const zoneIdsArray = Array.from(uniqueZoneIds);
      for (const zoneId of zoneIdsArray) {
        try {
          const airesData = await geographicApi.getAires(zoneId);
          airesData.forEach(aire => {
            airesMap.set(aire.id, aire);
          });
        } catch (error) {
          console.error(`Erreur lors du chargement des aires pour la zone ${zoneId}:`, error);
        }
      }
      setAllAires(airesMap);
    } catch (error: any) {
      console.error('Erreur lors du chargement des prestataires:', error);
      showAlert('Erreur', error.message || 'Erreur lors du chargement des prestataires', 'error');
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
    loadZones();
  }, [loadZones]);

  useEffect(() => {
    loadAires();
  }, [loadAires]);

  useEffect(() => {
    loadPrestataires();
  }, [loadPrestataires]);

  const formatDate = (date: string | null | undefined): string => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('fr-FR');
    } catch {
      return 'N/A';
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
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

  const handleImportKycReport = async () => {
    if (!importKycFile) {
      showAlert('Erreur', 'Veuillez sélectionner un fichier', 'error');
      return;
    }

    setImportingKyc(true);
    try {
      let kycResults: KycReportRow[] = [];
      const fileExtension = importKycFile.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Parser Excel
        const arrayBuffer = await importKycFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (data.length < 2) {
          showAlert('Erreur', 'Le fichier Excel est vide ou ne contient pas de données', 'error');
          return;
        }

        // Trouver les colonnes
        const headers = (data[0] || []).map((h: any) => String(h || '').trim().toLowerCase());
        const prestataireIdIndex = headers.findIndex((h: string) => 
          h.includes('prestataire') && h.includes('id')
        );
        const statusIndex = headers.findIndex((h: string) => 
          h.includes('status') || h.includes('statut')
        );
        const telephoneIndex = headers.findIndex((h: string) => 
          h.includes('telephone') || h.includes('phone') || h.includes('téléphone')
        );

        if (prestataireIdIndex === -1 || statusIndex === -1) {
          showAlert('Erreur', 'Format Excel invalide. Colonnes requises: prestataireId, status', 'error');
          return;
        }

        // Parser les lignes
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const prestataireId = String(row[prestataireIdIndex] || '').trim();
          const status = String(row[statusIndex] || '').trim().toUpperCase();
          const telephone = telephoneIndex !== -1 ? String(row[telephoneIndex] || '').trim() : undefined;

          if (prestataireId && ['CORRECT', 'INCORRECT', 'SANS_COMPTE'].includes(status)) {
            kycResults.push({
              prestataireId,
              status: status as 'CORRECT' | 'INCORRECT' | 'SANS_COMPTE',
              telephone: telephone || undefined,
            });
          }
        }
      } else {
        // Parser CSV
        const text = await importKycFile.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          showAlert('Erreur', 'Le fichier CSV est vide ou ne contient pas de données', 'error');
          return;
        }

        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        const prestataireIdIndex = headers.findIndex((h: string) => 
          h.includes('prestataire') && h.includes('id')
        );
        const statusIndex = headers.findIndex((h: string) => 
          h.includes('status') || h.includes('statut')
        );
        const telephoneIndex = headers.findIndex((h: string) => 
          h.includes('telephone') || h.includes('phone') || h.includes('téléphone')
        );

        if (prestataireIdIndex === -1 || statusIndex === -1) {
          showAlert('Erreur', 'Format CSV invalide. Colonnes requises: prestataireId, status', 'error');
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 2) continue;

          const prestataireId = values[prestataireIdIndex]?.trim();
          const status = values[statusIndex]?.trim().toUpperCase();
          const telephone = telephoneIndex !== -1 ? values[telephoneIndex]?.trim() : undefined;

          if (prestataireId && ['CORRECT', 'INCORRECT', 'SANS_COMPTE'].includes(status)) {
            kycResults.push({
              prestataireId,
              status: status as 'CORRECT' | 'INCORRECT' | 'SANS_COMPTE',
              telephone: telephone || undefined,
            });
          }
        }
      }

      if (kycResults.length === 0) {
        showAlert('Erreur', 'Aucun résultat KYC valide trouvé dans le fichier. Format CSV ou Excel attendu: prestataireId,status(CORRECT|INCORRECT|SANS_COMPTE),telephone(optionnel)', 'error');
        return;
      }

      const result = await partnersApi.importKycReport(
        { kycResults },
        selectedFormId || undefined,
      );

      if (result.errors.length > 0) {
        // Afficher les détails des erreurs dans la console pour le débogage
        console.error('[handleImportKycReport] Erreurs lors de l\'import:', result.errors);
        
        // Construire un message détaillé avec les premiers prestataires en erreur
        const errorDetails = result.errors.slice(0, 5).map(err => 
          `- ${err.prestataireId}: ${err.error}`
        ).join('\n');
        const moreErrors = result.errors.length > 5 ? `\n... et ${result.errors.length - 5} autres erreurs` : '';
        
        showAlert(
          'Import partiel',
          `${result.success} résultats KYC importés avec succès.\n\n${result.errors.length} erreur(s) rencontrée(s):\n${errorDetails}${moreErrors}\n\nVérifiez la console pour plus de détails.`,
          'warning',
        );
      } else {
        showAlert('Succès', `${result.success} résultats KYC importés avec succès`, 'success');
      }

      setShowImportKycModal(false);
      setImportKycFile(null);
      setImportKycFileName('');
      loadPrestataires();
    } catch (error: any) {
      console.error('Erreur lors de l\'import KYC:', error);
      showAlert('Erreur', error.message || 'Erreur lors de l\'import du rapport KYC', 'error');
    } finally {
      setImportingKyc(false);
    }
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
    const filename = 'prestataires-enregistres-kyc';
    
    await exportData(
      format,
      exportDataRows,
      exportColumns,
      filename,
      tableElement as HTMLElement | undefined,
      'Prestataires Enregistrés - KYC'
    );
  };

  const columns: Column[] = [
    {
      key: 'prestataireId',
      label: 'ID Prestataire',
      sortable: true,
    },
    {
      key: 'nom',
      label: 'Nom',
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const rawData = prestataire.rawData || prestataire.raw_data || {};
        const nom = prestataire.nom || 
                   prestataire.family_name_i_c || 
                   prestataire.Nom || 
                   prestataire.family_name || 
                   rawData.nom || 
                   rawData.family_name_i_c || 
                   rawData.Nom || 
                   rawData.family_name || 
                   rawData.name;
        const prenom = prestataire.prenom || 
                      prestataire.given_name_i_c || 
                      prestataire.Prenom || 
                      prestataire.Prénom || 
                      prestataire.firstName ||
                      rawData.prenom || 
                      rawData.given_name_i_c || 
                      rawData.Prenom || 
                      rawData.Prénom || 
                      rawData.prenom_complet || 
                      rawData.firstName;
        const postnom = prestataire.postnom || 
                       prestataire.middle_name_i_c || 
                       prestataire.Postnom || 
                       prestataire.post_nom || 
                       prestataire.lastName ||
                       rawData.postnom || 
                       rawData.middle_name_i_c || 
                       rawData.Postnom || 
                       rawData.post_nom || 
                       rawData.postnom_complet || 
                       rawData.lastName;
        
        const fullName = `${prenom || ''} ${nom || ''} ${postnom || ''}`.trim();
        return fullName || prestataire.nom_complet || prestataire.fullName || prestataire.full_name || 'N/A';
      },
    },
    {
      key: 'telephone',
      label: 'Téléphone',
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const rawData = prestataire.rawData || prestataire.raw_data || {};
        const telephone = prestataire.telephone || 
                         prestataire.num_phone || 
                         prestataire.confirm_phone || 
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
      label: 'Rôle/Catégorie',
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const categorie = prestataire.categorie || prestataire.role || prestataire.campaign_role || prestataire.campaign_role_i_f || 'N/A';
        return categorie;
      },
    },
    {
      key: 'province',
      label: 'Province',
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const provinceId = prestataire.provinceId || prestataire.province_id;
        if (!provinceId) return 'N/A';
        const province = provinces.find(p => p.id === provinceId);
        return province?.name || provinceId;
      },
    },
    {
      key: 'zone',
      label: 'Zone de Santé',
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const zoneId = prestataire.zoneId || prestataire.zone_id;
        if (!zoneId) return 'N/A';
        // Chercher dans allZones d'abord, puis dans zones (pour les filtres)
        const zone = allZones.get(zoneId) || zones.find(z => z.id === zoneId);
        return zone?.name || zoneId;
      },
    },
    {
      key: 'aire',
      label: 'Aire de Santé',
      sortable: true,
      render: (value: any, prestataire: PrestataireForPartner) => {
        const aireId = prestataire.aireId || prestataire.aire_id;
        if (!aireId) return 'N/A';
        // Chercher dans allAires d'abord, puis dans aires (pour les filtres)
        const aire = allAires.get(aireId) || aires.find(a => a.id === aireId);
        return aire?.name || aireId;
      },
    },
    {
      key: 'kycStatus',
      label: 'Statut KYC',
      render: (value: any, prestataire: PrestataireForPartner) => {
        const kycStatus = prestataire.kycStatus || prestataire.kyc_status;
        if (!kycStatus) return <span className="text-gray-500">Non vérifié</span>;
        
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
      },
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
          Vérification KYC
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Vérification KYC des prestataires enregistrés
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
                  {zone.name}
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
                  {aire.name}
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
        <div className="text-center py-12">
          <p className="text-gray-500">Chargement...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Prestataires Enregistrés ({prestataires.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportKycModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Importer rapport KYC
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exporter
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
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : (
              <DataTable
                data={prestataires}
                columns={columns}
                exportFilename="prestataires-enregistres-kyc"
                hideHeader={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal d'import KYC */}
      {showImportKycModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4" style={{ color: '#111827' }}>Importer un rapport de résultats KYC</h2>
            <p className="text-sm mb-4" style={{ color: '#374151' }}>
              Format CSV ou Excel attendu: prestataireId,status(CORRECT|INCORRECT|SANS_COMPTE),telephone(optionnel)
            </p>
            <div className="mb-4 text-xs" style={{ color: '#374151' }}>
              <p className="font-medium mb-2" style={{ color: '#111827' }}>Les statuts possibles sont :</p>
              <ul className="list-disc list-inside mt-1 space-y-1" style={{ color: '#374151' }}>
                <li>CORRECT - Le prestataire a passé la vérification KYC</li>
                <li>INCORRECT - Le prestataire n'a pas passé la vérification KYC</li>
                <li>SANS_COMPTE - Le prestataire n'a pas de compte mobile money</li>
              </ul>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: '#111827' }}>
                Fichier à importer
              </label>
              <div className="flex gap-2 items-center">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setImportKycFile(file);
                      setImportKycFileName(file ? file.name : '');
                    }}
                    className="hidden"
                    id="kyc-file-input"
                  />
                  <div className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white text-center cursor-pointer">
                    <span className="text-sm" style={{ color: '#374151' }}>
                      {importKycFileName || 'Choisir un fichier'}
                    </span>
                  </div>
                </label>
                {importKycFile && (
                  <button
                    onClick={() => {
                      setImportKycFile(null);
                      setImportKycFileName('');
                      const input = document.getElementById('kyc-file-input') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
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
                  setShowImportKycModal(false);
                  setImportKycFile(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
                style={{ color: '#374151' }}
                disabled={importingKyc}
              >
                Annuler
              </button>
              <button
                onClick={handleImportKycReport}
                disabled={!importKycFile || importingKyc}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:text-white"
              >
                {importingKyc ? 'Importation...' : 'Importer'}
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

