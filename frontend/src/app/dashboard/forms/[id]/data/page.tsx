'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../../../store/authStore';
import { formsApi } from '../../../../../lib/api/forms';
import { campaignsApi } from '../../../../../lib/api/campaigns';
import { Form, Campaign } from '../../../../../types';
import Link from 'next/link';
import AlertModal from '../../../../../components/Modal/AlertModal';

export default function FormDataPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'data' | 'validation' | 'approbation' | 'paiement'>('summary');
  const [statistics, setStatistics] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [allData, setAllData] = useState<any[]>([]); // Toutes les données non filtrées
  const [validationData, setValidationData] = useState<any[]>([]); // Données validées
  const [approbationData, setApprobationData] = useState<any[]>([]); // Données approuvées
  const [paiementData, setPaiementData] = useState<any[]>([]); // Données de paiement
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

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

  useEffect(() => {
    if (user?.role === 'SUPERADMIN' && params.id) {
      loadForm();
    }
  }, [params.id, user]);

  // Charger les colonnes visibles depuis localStorage ou initialiser avec toutes les colonnes
  useEffect(() => {
    if (form) {
      const publishedVersion = form.versions?.find((v) => v.isPublished);
      if (publishedVersion) {
        const schema = publishedVersion.schema;
        const fields = schema?.properties ? Object.keys(schema.properties) : [];
        
        // Charger depuis localStorage
        const savedColumns = localStorage.getItem(`form_${params.id}_visible_columns`);
        if (savedColumns) {
          try {
            const saved = JSON.parse(savedColumns);
            setVisibleColumns(new Set(saved));
          } catch (e) {
            // Si erreur, initialiser avec toutes les colonnes sauf celles sensibles
            const defaultVisible = fields.filter(field => {
              const fieldLower = field.toLowerCase();
              // Exclure les colonnes sensibles par défaut
              return !fieldLower.includes('consentement') && 
                     !fieldLower.includes('consent') &&
                     !fieldLower.includes('password') &&
                     !fieldLower.includes('token');
            });
            setVisibleColumns(new Set(defaultVisible));
          }
        } else {
          // Initialiser avec toutes les colonnes sauf celles sensibles
          const defaultVisible = fields.filter(field => {
            const fieldLower = field.toLowerCase();
            // Exclure les colonnes sensibles par défaut
            return !fieldLower.includes('consentement') && 
                   !fieldLower.includes('consent') &&
                   !fieldLower.includes('password') &&
                   !fieldLower.includes('token');
          });
          setVisibleColumns(new Set(defaultVisible));
        }
      }
    }
  }, [form, params.id]);

  // Fonction pour trouver le nom de colonne réel dans les données
  const findColumnName = useCallback((fieldName: string, sampleRow: any): string | null => {
    if (!sampleRow) return null;
    
    // Mapping des noms de champs communs
    const fieldMappings: Record<string, string[]> = {
      'province': ['provinceId', 'province_id', 'admin1_h_c', 'admin1'],
      'antenne': ['antenneId', 'antenne_id', 'admin2_h_c', 'admin2'],
      'zone': ['zoneId', 'zone_id', 'admin3_h_c', 'admin3', 'zone_de_sante'],
      'aire': ['aireId', 'aire_id', 'admin4_h_c', 'admin4', 'aire_de_sante'],
    };
    
    // Chercher dans les mappings
    const fieldNameLower = fieldName.toLowerCase();
    for (const [key, variants] of Object.entries(fieldMappings)) {
      if (fieldNameLower.includes(key)) {
        for (const variant of variants) {
          if (sampleRow[variant] !== undefined && sampleRow[variant] !== null) {
            return variant;
          }
        }
      }
    }
    
    // Essayer directement le nom du champ
    if (sampleRow[fieldName] !== undefined) return fieldName;
    
    // Essayer les variantes de casse
    const lower = fieldName.toLowerCase();
    const upper = fieldName.toUpperCase();
    if (sampleRow[lower] !== undefined) return lower;
    if (sampleRow[upper] !== undefined) return upper;
    
    // Essayer avec Id suffix
    if (sampleRow[`${fieldName}Id`] !== undefined) return `${fieldName}Id`;
    if (sampleRow[`${fieldName}_id`] !== undefined) return `${fieldName}_id`;
    
    // Chercher dans toutes les clés (insensible à la casse)
    const allKeys = Object.keys(sampleRow);
    const matchingKey = allKeys.find(k => k.toLowerCase() === fieldName.toLowerCase());
    if (matchingKey) return matchingKey;
    
    return null;
  }, []);

  // Fonction pour appliquer les filtres aux données
  const applyFilters = useCallback(() => {
    if (allData.length === 0) {
      console.log('⚠️ allData est vide, impossible d\'appliquer les filtres');
      return;
    }
    
    // Debug: afficher les filtres appliqués
    if (Object.keys(filters).length > 0) {
      console.log('🔧 Application des filtres:', { 
        allDataLength: allData.length, 
        filters, 
        page, 
        limit 
      });
    }
    
    let filteredData = [...allData];
    
    // Pour les utilisateurs IT avec scope AIRE, filtrer par aire de santé
    if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
      filteredData = filteredData.filter((row: any) => {
        const realAireColumn = findColumnName('aire', row) || findColumnName('aireId', row);
        if (realAireColumn) {
          const rowAireId = row[realAireColumn];
          return rowAireId === user.aireId;
        }
        return false;
      });
    }
    
    const sampleRow = filteredData[0] || allData[0];

    // Appliquer chaque filtre
    Object.entries(filters).forEach(([field, filterValue]) => {
      if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0) || filterValue === '') {
        return;
      }

      // Trouver le nom de colonne réel dans les données
      const realColumnName = findColumnName(field, sampleRow) || field;
      
      if (realColumnName !== field) {
        console.log(`📌 Mapping de colonne: ${field} -> ${realColumnName}`);
      }

      const initialCount = filteredData.length;
      filteredData = filteredData.filter((row) => {
        // Utiliser le nom de colonne réel trouvé
        const rowValue = row[realColumnName];
        
        if (Array.isArray(filterValue)) {
          // Filtre multiple (select) - comparaison exacte
          if (filterValue.length === 0) return true;
          const rowValueStr = rowValue !== undefined && rowValue !== null ? String(rowValue).trim() : '';
          const matches = filterValue.some(fv => {
            const filterValStr = String(fv).trim();
            const match = filterValStr === rowValueStr;
            // Debug pour les premières lignes seulement si pas de match
            if (!match && filteredData.indexOf(row) < 1 && filterValue.length === 1) {
              console.log(`  🔎 [${field}] Comparaison: "${filterValStr}" === "${rowValueStr}" ? ${match}`, {
                rowValue,
                filterValue: fv,
                rowKeys: Object.keys(row).filter(k => k.toLowerCase().includes(field.toLowerCase())),
                allRowKeys: Object.keys(row)
              });
            }
            return match;
          });
          return matches;
        } else {
          // Filtre texte (recherche)
          const searchValue = String(filterValue).toLowerCase().trim();
          const cellValue = rowValue !== undefined && rowValue !== null ? String(rowValue).toLowerCase().trim() : '';
          return cellValue.includes(searchValue);
        }
      });
      
      // Debug: afficher le nombre de résultats filtrés
      if (initialCount !== filteredData.length) {
        console.log(`🔍 Filtre ${field}: ${initialCount} -> ${filteredData.length} résultats`, {
          field,
          filterValue,
          sampleRowValue: filteredData[0]?.[field],
          firstRowKeys: Object.keys(filteredData[0] || {}).filter(k => k.toLowerCase().includes(field.toLowerCase()))
        });
      }
    });

    // Appliquer la pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    console.log('✅ Données filtrées mises à jour:', {
      filteredCount: filteredData.length,
      paginatedCount: paginatedData.length,
      page,
      limit
    });
    setData(paginatedData);
    setTotal(filteredData.length);
  }, [allData, filters, page, limit, user, findColumnName]);

  // Charger les campagnes
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const campaignsData = await campaignsApi.getAll();
        setCampaigns(campaignsData);
      } catch (error) {
        console.error('Erreur lors du chargement des campagnes:', error);
      }
    };
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (activeTab === 'summary' && form) {
      loadStatistics();
    } else if (activeTab === 'data' && form) {
      loadData();
    } else if (activeTab === 'validation' && form) {
      loadValidationData();
    } else if (activeTab === 'approbation' && form) {
      loadApprobationData();
    } else if (activeTab === 'paiement' && form) {
      loadPaiementData();
    }
  }, [activeTab, form, selectedCampaignId]);

  // Appliquer les filtres quand ils changent ou quand on change de page ou d'onglet
  useEffect(() => {
    if (activeTab === 'validation' || activeTab === 'approbation' || activeTab === 'paiement') {
      // Pour les nouveaux onglets, utiliser directement les données filtrées
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = allData.slice(startIndex, endIndex);
      setData(paginatedData);
      setTotal(allData.length);
    } else if (activeTab === 'data') {
      // Pour DATA, utiliser la logique existante
      applyFilters();
    }
  }, [allData, page, limit, activeTab, applyFilters]);

  // Fermer les dropdowns quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdowns(new Set());
    };
    if (openDropdowns.size > 0) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openDropdowns]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const data = await formsApi.getById(params.id as string);
      setForm(data);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showAlert('Erreur', 'Impossible de charger le formulaire', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await formsApi.getStatistics(params.id as string);
      setStatistics(stats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      showAlert('Erreur', 'Impossible de charger les statistiques', 'error');
    }
  };

  const loadData = async () => {
    try {
      setLoadingData(true);
      // Charger toutes les données pour permettre le filtrage côté client
      const result = await formsApi.getPrestatairesData(params.id as string, 1, 10000);
      setAllData(result.data);
      // Debug: afficher la structure des données
      if (process.env.NODE_ENV === 'development' && result.data.length > 0) {
        console.log('Données chargées:', result.data.length, 'lignes');
        console.log('Exemple de ligne:', result.data[0]);
        console.log('Clés disponibles:', Object.keys(result.data[0] || {}));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      showAlert('Erreur', 'Impossible de charger les données', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const loadValidationData = async () => {
    try {
      setLoadingData(true);
      const result = await formsApi.getPrestatairesData(params.id as string, 1, 10000);
      // Filtrer les prestataires validés (validation_status non null/vide)
      let validated = result.data.filter((row: any) => {
        const validationStatus = row.validation_status || row.kyc_status || row.status;
        return validationStatus && validationStatus !== 'ENREGISTRE' && validationStatus !== '' && validationStatus !== null;
      });
      // Filtrer par campagne si sélectionnée
      if (selectedCampaignId) {
        validated = validated.filter((row: any) => {
          const campaignId = row.campaign_id || row.campaignId;
          return campaignId === selectedCampaignId;
        });
      }
      // Pour les utilisateurs IT avec scope AIRE, filtrer par aire de santé
      if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
        validated = validated.filter((row: any) => {
          const realAireColumn = findColumnName('aire', row) || findColumnName('aireId', row);
          if (realAireColumn) {
            return row[realAireColumn] === user.aireId;
          }
          return false;
        });
      }
      setValidationData(validated);
      setAllData(validated); // Utiliser allData pour le filtrage
    } catch (error) {
      console.error('Erreur lors du chargement des données de validation:', error);
      showAlert('Erreur', 'Impossible de charger les données de validation', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const loadApprobationData = async () => {
    try {
      setLoadingData(true);
      const result = await formsApi.getPrestatairesData(params.id as string, 1, 10000);
      // Filtrer les prestataires approuvés (approval_status non null/vide)
      let approved = result.data.filter((row: any) => {
        const approvalStatus = row.approval_status;
        return approvalStatus && approvalStatus !== '' && approvalStatus !== null;
      });
      // Filtrer par campagne si sélectionnée
      if (selectedCampaignId) {
        approved = approved.filter((row: any) => {
          const campaignId = row.campaign_id || row.campaignId;
          return campaignId === selectedCampaignId;
        });
      }
      // Pour les utilisateurs IT avec scope AIRE, filtrer par aire de santé
      if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
        approved = approved.filter((row: any) => {
          const realAireColumn = findColumnName('aire', row) || findColumnName('aireId', row);
          if (realAireColumn) {
            return row[realAireColumn] === user.aireId;
          }
          return false;
        });
      }
      setApprobationData(approved);
      setAllData(approved); // Utiliser allData pour le filtrage
    } catch (error) {
      console.error('Erreur lors du chargement des données d\'approbation:', error);
      showAlert('Erreur', 'Impossible de charger les données d\'approbation', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const loadPaiementData = async () => {
    try {
      setLoadingData(true);
      const result = await formsApi.getPrestatairesData(params.id as string, 1, 10000);
      // Filtrer les prestataires payés (payment_status non null/vide ou paid_at non null)
      let paid = result.data.filter((row: any) => {
        const paymentStatus = row.payment_status;
        const paidAt = row.paid_at || row.payment_date;
        return (paymentStatus && paymentStatus !== '' && paymentStatus !== null) || paidAt;
      });
      // Filtrer par campagne si sélectionnée
      if (selectedCampaignId) {
        paid = paid.filter((row: any) => {
          const campaignId = row.campaign_id || row.campaignId;
          return campaignId === selectedCampaignId;
        });
      }
      // Pour les utilisateurs IT avec scope AIRE, filtrer par aire de santé
      if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
        paid = paid.filter((row: any) => {
          const realAireColumn = findColumnName('aire', row) || findColumnName('aireId', row);
          if (realAireColumn) {
            return row[realAireColumn] === user.aireId;
          }
          return false;
        });
      }
      setPaiementData(paid);
      setAllData(paid); // Utiliser allData pour le filtrage
    } catch (error) {
      console.error('Erreur lors du chargement des données de paiement:', error);
      showAlert('Erreur', 'Impossible de charger les données de paiement', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value === '') {
        delete newFilters[field];
      } else {
        newFilters[field] = value;
      }
      return newFilters;
    });
    setPage(1); // Reset to first page when filtering
  };

  const handleMultiSelectChange = (field: string, selectedValues: string[]) => {
    console.log('🔄 handleMultiSelectChange:', { field, selectedValues });
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (selectedValues.length === 0) {
        delete newFilters[field];
      } else {
        newFilters[field] = selectedValues;
      }
      console.log('📝 Nouveaux filtres:', newFilters);
      return newFilters;
    });
    setPage(1); // Reset to first page when filtering
  };

  // Fonction pour détecter si un champ est de type select/enum
  const isSelectField = (fieldSchema: any, fieldName: string): boolean => {
    if (!fieldSchema) return false;
    
    // Vérifier les noms de champs communs pour les selects
    const fieldNameLower = fieldName.toLowerCase();
    const selectFieldNames = ['province', 'antenne', 'zone', 'aire', 'sante', 'health'];
    if (selectFieldNames.some(name => fieldNameLower.includes(name))) {
      return true;
    }
    
    // Vérifier le schéma
    return (
      fieldSchema?.enum !== undefined ||
      fieldSchema?.['x-select'] !== undefined ||
      fieldSchema?.['x-choices'] !== undefined ||
      (fieldSchema?.type === 'string' && fieldSchema?.enum !== undefined)
    );
  };

  // Fonction pour obtenir les valeurs uniques avec leurs libellés
  const getUniqueValuesWithLabels = (fieldName: string): Array<{ value: string; label: string }> => {
    const valueMap = new Map<string, string>();
    // Utiliser allData pour avoir toutes les valeurs disponibles, pas seulement les données filtrées
    let dataSource = allData.length > 0 ? allData : data;
    
    // Pour les utilisateurs IT avec scope AIRE, filtrer par aire de santé
    if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
      dataSource = dataSource.filter((row: any) => {
        const realAireColumn = findColumnName('aire', row) || findColumnName('aireId', row);
        if (realAireColumn) {
          const rowAireId = row[realAireColumn];
          return rowAireId === user.aireId;
        }
        return false;
      });
    }
    
    if (dataSource.length === 0) return [];
    
    // Trouver le nom de colonne réel dans les données
    const sampleRow = dataSource[0];
    const realColumnName = findColumnName(fieldName, sampleRow) || fieldName;
    const fieldSchema = schema?.properties?.[fieldName];
    
    // Pour les utilisateurs IT avec scope AIRE, limiter les options selon la hiérarchie
    const isGeographicField = fieldName.toLowerCase().includes('province') || 
                              fieldName.toLowerCase().includes('antenne') ||
                              fieldName.toLowerCase().includes('zone') ||
                              fieldName.toLowerCase().includes('aire');
    
    if (user && user.role === 'IT' && user.scope === 'AIRE' && isGeographicField) {
      // Limiter les options selon la hiérarchie
      if (fieldName.toLowerCase().includes('province') && user.provinceId) {
        // Ne montrer que la province de l'utilisateur
        dataSource = dataSource.filter((row: any) => {
          const realProvinceColumn = findColumnName('province', row) || findColumnName('provinceId', row);
          if (realProvinceColumn) {
            return row[realProvinceColumn] === user.provinceId;
          }
          return false;
        });
      }
      if (fieldName.toLowerCase().includes('zone') && user.zoneId) {
        // Ne montrer que la zone de l'utilisateur
        dataSource = dataSource.filter((row: any) => {
          const realZoneColumn = findColumnName('zone', row) || findColumnName('zoneId', row);
          if (realZoneColumn) {
            return row[realZoneColumn] === user.zoneId;
          }
          return false;
        });
      }
      if (fieldName.toLowerCase().includes('aire') && user.aireId) {
        // Ne montrer que l'aire de l'utilisateur
        dataSource = dataSource.filter((row: any) => {
          const realAireColumn = findColumnName('aire', row) || findColumnName('aireId', row);
          if (realAireColumn) {
            return row[realAireColumn] === user.aireId;
          }
          return false;
        });
      }
    }
    
    // Récupérer les options depuis le schéma
    const options = fieldSchema?.['x-options'] || fieldSchema?.options || [];
    const optionsMap = new Map<string, string>();
    if (Array.isArray(options)) {
      options.forEach((opt: any) => {
        const optValue = String(opt.value || opt.name || '');
        const optLabel = opt.label || optValue;
        optionsMap.set(optValue.trim(), optLabel);
      });
    }
    
    // Collecter les valeurs uniques depuis les données
    dataSource.forEach((row) => {
      const value = row[realColumnName];
      if (value !== undefined && value !== null && value !== '') {
        const valueStr = String(value).trim();
        if (!valueMap.has(valueStr)) {
          // Utiliser le libellé du schéma si disponible, sinon la valeur
          const label = optionsMap.get(valueStr) || valueStr;
          valueMap.set(valueStr, label);
        }
      }
    });
    
    // Retourner sous forme d'array trié par libellé
    return Array.from(valueMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  // Fonction pour obtenir les valeurs uniques d'un champ depuis les données (pour compatibilité)
  const getUniqueValues = (fieldName: string): string[] => {
    return getUniqueValuesWithLabels(fieldName).map(item => item.value);
  };

  // Fonction pour convertir une valeur technique en libellé
  const getLabelFromValue = (value: any, fieldSchema?: any): string | null => {
    if (!fieldSchema || value === undefined || value === null) {
      return null;
    }

    // Récupérer les options depuis x-options
    const options = fieldSchema['x-options'] || fieldSchema.options || [];
    if (!Array.isArray(options) || options.length === 0) {
      return null;
    }

    // Chercher l'option correspondante
    const option = options.find((opt: any) => {
      const optValue = opt.value || opt.name;
      return String(optValue).trim() === String(value).trim();
    });

    return option?.label || null;
  };

  // Fonction pour formater l'affichage des valeurs dans le tableau
  const formatCellValue = (value: any, fieldName: string, fieldSchema?: any): { display: string; isImage: boolean; fullValue: string } => {
    if (value === undefined || value === null) {
      return { display: '-', isImage: false, fullValue: '' };
    }

    const stringValue = String(value);
    let displayValue = stringValue;
    const fullValue = stringValue;

    // Pour les champs select (province, antenne, zone, aire), convertir en libellé
    const fieldNameLower = fieldName.toLowerCase();
    const isGeographicField = 
      fieldNameLower.includes('province') ||
      fieldNameLower.includes('antenne') ||
      fieldNameLower.includes('zone') ||
      fieldNameLower.includes('aire') ||
      fieldNameLower.includes('admin1') ||
      fieldNameLower.includes('admin2') ||
      fieldNameLower.includes('admin3') ||
      fieldNameLower.includes('admin4');

    if (isGeographicField && fieldSchema) {
      const label = getLabelFromValue(value, fieldSchema);
      if (label) {
        displayValue = label;
      }
    }

    // Détecter si c'est un champ d'image
    const isImageField = 
      fieldNameLower.includes('photo') ||
      fieldNameLower.includes('signature') ||
      fieldNameLower.includes('image') ||
      fieldNameLower.includes('picture') ||
      fieldNameLower.includes('img') ||
      fieldSchema?.format === 'uri' ||
      fieldSchema?.format === 'data-url' ||
      /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(stringValue) ||
      /^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(stringValue) ||
      /^data:image\//i.test(stringValue);

    // Si c'est une image ou un chemin très long, tronquer
    const maxLength = isImageField ? 40 : 80;
    if (displayValue.length > maxLength) {
      const truncated = displayValue.substring(0, maxLength) + '...';
      return {
        display: truncated,
        isImage: isImageField,
        fullValue: fullValue,
      };
    }

    return {
      display: displayValue,
      isImage: isImageField,
      fullValue: fullValue,
    };
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    showAlert('Info', 'Fonctionnalité d\'export à venir', 'info');
  };

  const handleToggleColumn = (fieldName: string) => {
    setVisibleColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
  };

  const handleSelectAllColumns = () => {
    if (form) {
      const publishedVersion = form.versions?.find((v) => v.isPublished);
      if (publishedVersion) {
        const schema = publishedVersion.schema;
        const fields = schema?.properties ? Object.keys(schema.properties) : [];
        setVisibleColumns(new Set(fields));
      }
    }
  };

  const handleDeselectAllColumns = () => {
    setVisibleColumns(new Set());
  };

  const handleSaveColumnSelection = () => {
    // Sauvegarder dans localStorage
    localStorage.setItem(
      `form_${params.id}_visible_columns`,
      JSON.stringify(Array.from(visibleColumns))
    );
    setShowColumnModal(false);
  };

  const handleCancelColumnSelection = () => {
    // Restaurer depuis localStorage
    if (form) {
      const publishedVersion = form.versions?.find((v) => v.isPublished);
      if (publishedVersion) {
        const schema = publishedVersion.schema;
        const fields = schema?.properties ? Object.keys(schema.properties) : [];
        
        const savedColumns = localStorage.getItem(`form_${params.id}_visible_columns`);
        if (savedColumns) {
          try {
            const saved = JSON.parse(savedColumns);
            setVisibleColumns(new Set(saved));
          } catch (e) {
            // Si erreur, utiliser les colonnes par défaut
            const defaultVisible = fields.filter(field => {
              const fieldLower = field.toLowerCase();
              return !fieldLower.includes('consentement') && 
                     !fieldLower.includes('consent') &&
                     !fieldLower.includes('password') &&
                     !fieldLower.includes('token');
            });
            setVisibleColumns(new Set(defaultVisible));
          }
        }
      }
    }
    setShowColumnModal(false);
  };

  // Obtenir publishedVersion et schema AVANT les hooks (toujours calculer, même si form est null)
  const publishedVersion = form?.versions?.find((v) => v.isPublished);
  const schema = publishedVersion?.schema;
  const fields = schema?.properties ? Object.keys(schema.properties) : [];

  // Fonction pour récupérer une valeur depuis les données (cherche dans plusieurs variantes)
  const getValueFromRow = useCallback((fieldName: string, row: any): any => {
    if (!row) return null;
    
    // Mapping des noms techniques vers les libellés et vice versa
    const fieldMappings: Record<string, string[]> = {
      'prenom': ['given_name_i_c', 'Prénom', 'prenom', 'Prenom'],
      'given_name_i_c': ['given_name_i_c', 'Prénom', 'prenom', 'Prenom'],
      'nom': ['family_name_i_c', 'Nom', 'nom'],
      'family_name_i_c': ['family_name_i_c', 'Nom', 'nom'],
      'postnom': ['middle_name_i_c', 'Post nom', 'Postnom', 'postnom', 'post_nom'],
      'middle_name_i_c': ['middle_name_i_c', 'Post nom', 'Postnom', 'postnom', 'post_nom'],
    };
    
    // Obtenir toutes les variantes possibles pour ce champ
    const variants = fieldMappings[fieldName] || [fieldName];
    
    // Essayer chaque variante dans l'ordre
    for (const variant of variants) {
      // Essayer directement le nom du champ
      if (row[variant] !== undefined && row[variant] !== null && row[variant] !== '') {
        return row[variant];
      }
      
      // Chercher avec findColumnName
      const realColumnName = findColumnName(variant, row);
      if (realColumnName && row[realColumnName] !== undefined && row[realColumnName] !== null && row[realColumnName] !== '') {
        return row[realColumnName];
      }
    }
    
    // Chercher dans raw_data si présent (peut être string JSON ou objet)
    if (row.raw_data) {
      let rawData = row.raw_data;
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }
      if (typeof rawData === 'object' && rawData !== null) {
        // Chercher chaque variante dans raw_data
        for (const variant of variants) {
          if (rawData[variant] !== undefined && rawData[variant] !== null && rawData[variant] !== '') {
            return rawData[variant];
          }
        }
        // Chercher les variantes de casse dans raw_data
        const fieldNameLower = fieldName.toLowerCase();
        for (const key in rawData) {
          if (key.toLowerCase() === fieldNameLower && rawData[key] !== undefined && rawData[key] !== null && rawData[key] !== '') {
            return rawData[key];
          }
        }
      }
    }
    
    // Chercher dans enregistrementData si présent
    if (row.enregistrementData && typeof row.enregistrementData === 'object') {
      for (const variant of variants) {
        if (row.enregistrementData[variant] !== undefined && row.enregistrementData[variant] !== null && row.enregistrementData[variant] !== '') {
          return row.enregistrementData[variant];
        }
      }
    }
    
    // Chercher les variantes de casse dans row
    const fieldNameLower = fieldName.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === fieldNameLower && row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    
    return null;
  }, [findColumnName]);

  // Fonction pour formater les valeurs spéciales pour les nouveaux onglets
  const formatSpecialCell = useCallback((fieldName: string, row: any, fieldSchema?: any): string => {
    // Combiner prenom + nom + postnom pour la colonne "nom" (ordre: Prenom Nom Postnom)
    if (fieldName === 'nom' || fieldName === 'nom_complet') {
      // D'abord essayer nom_complet directement
      let nomComplet = getValueFromRow('nom_complet', row);
      if (nomComplet && nomComplet !== '-') {
        return String(nomComplet);
      }
      
      // Sinon, chercher séparément prenom, nom, postnom
      // Noms techniques: given_name_i_c (prénom), family_name_i_c (nom), middle_name_i_c (postnom)
      // Libellés: Prénom, Nom, Post nom
      const prenom = getValueFromRow('given_name_i_c', row) || 
                     getValueFromRow('prenom', row) || 
                     getValueFromRow('Prenom', row) || 
                     getValueFromRow('Prénom', row) || '';
      const nom = getValueFromRow('family_name_i_c', row) || 
                  getValueFromRow('nom', row) || 
                  getValueFromRow('Nom', row) || '';
      const postnom = getValueFromRow('middle_name_i_c', row) || 
                      getValueFromRow('postnom', row) || 
                      getValueFromRow('Postnom', row) || 
                      getValueFromRow('Post nom', row) || 
                      getValueFromRow('post_nom', row) || '';
      // Ordre: Prenom Nom Postnom
      const parts = [prenom, nom, postnom].filter(p => p && String(p).trim() && p !== 'null' && p !== 'undefined' && p !== '');
      return parts.length > 0 ? parts.join(' ') : '-';
    }
    
    // Pour validation_status et kyc_status - chercher les deux et convertir en label
    if (fieldName === 'validation_status' || fieldName === 'kyc_status') {
      const validationStatus = getValueFromRow('validation_status', row) || getValueFromRow('kyc_status', row) || getValueFromRow('status', row);
      if (validationStatus && validationStatus !== '-' && validationStatus !== null && validationStatus !== '') {
        // Mapping des statuts de validation (noms techniques -> labels)
        const statusLabels: Record<string, string> = {
          'VALIDE_PAR_IT': 'Validé par IT',
          'VALIDÉ_PAR_IT': 'Validé par IT',
          'valide_par_it': 'Validé par IT',
          'ENREGISTRE': 'Enregistré',
          'enregistre': 'Enregistré',
          'EN_ATTENTE': 'En attente',
          'en_attente': 'En attente',
          'EN_ATTENTE_PAR_MCZ': 'En attente par MCZ',
          'en_attente_par_mcz': 'En attente par MCZ',
          'REJETE': 'Rejeté',
          'rejete': 'Rejeté',
          'REJETE_PAR_MCZ': 'Rejeté par MCZ',
          'rejete_par_mcz': 'Rejeté par MCZ',
          'APPROUVE': 'Approuvé',
          'approuve': 'Approuvé',
          'APPROUVE_PAR_MCZ': 'Approuvé par MCZ',
          'approuve_par_mcz': 'Approuvé par MCZ',
          'PAYE': 'Payé',
          'paye': 'Payé',
          'PENDING': 'En attente',
          'SENT': 'Envoyé',
        };
        
        // Chercher d'abord dans le mapping manuel
        const statusStr = String(validationStatus).trim();
        if (statusLabels[statusStr]) {
          return statusLabels[statusStr];
        }
        
        // Chercher le schéma du champ validation_status pour obtenir les options
        const statusFieldSchema = schema?.properties?.['validation_status'] || schema?.properties?.['kyc_status'];
        if (statusFieldSchema) {
          const label = getLabelFromValue(validationStatus, statusFieldSchema);
          if (label) {
            return label;
          }
        }
        
        // Si pas de label trouvé, formater la valeur (remplacer les underscores par des espaces et capitaliser)
        return statusStr
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      return '-';
    }
    
    // Pour validation_date - chercher dans toutes les variantes et formater correctement
    if (fieldName === 'validation_date' || fieldName === 'validated_at') {
      // Chercher dans toutes les variantes possibles (colonne directe, raw_data, enregistrementData)
      let validationDate = getValueFromRow('validation_date', row);
      if (!validationDate || validationDate === '-' || validationDate === null || validationDate === '') {
        validationDate = getValueFromRow('validated_at', row);
      }
      if (!validationDate || validationDate === '-' || validationDate === null || validationDate === '') {
        validationDate = getValueFromRow('validationDate', row);
      }
      
      // Chercher aussi dans les colonnes de date système
      if (!validationDate || validationDate === '-' || validationDate === null || validationDate === '') {
        // Si c'est dans l'onglet validation, chercher dans la table validations_it
        if (row.createdAt && (fieldName === 'validation_date' || fieldName === 'validated_at')) {
          validationDate = row.createdAt;
        }
      }
      
      if (validationDate && validationDate !== '-' && validationDate !== null && validationDate !== '') {
        // Formater la date si c'est une date (TIMESTAMP PostgreSQL)
        try {
          // PostgreSQL TIMESTAMP peut être au format ISO ou autre
          let date: Date;
          if (typeof validationDate === 'string') {
            // Essayer de parser directement
            date = new Date(validationDate);
            // Si ça ne marche pas, essayer de nettoyer la chaîne (enlever les timezone si nécessaire)
            if (isNaN(date.getTime())) {
              // Essayer avec différentes variantes
              const cleaned = validationDate.replace(/T/, ' ').replace(/Z$/, '').trim();
              date = new Date(cleaned);
            }
          } else if (validationDate instanceof Date) {
            date = validationDate;
          } else {
            date = new Date(validationDate);
          }
          
          if (!isNaN(date.getTime())) {
            // Formater en français avec date et heure
            return date.toLocaleString('fr-FR', { 
              year: 'numeric', 
              month: '2-digit', 
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        } catch (e) {
          // Si erreur de parsing, retourner la valeur telle quelle
          console.warn('Erreur lors du formatage de la date:', e, validationDate);
        }
        return String(validationDate);
      }
      return '-';
    }
    
    // Pour les autres champs, récupérer la valeur
    const value = getValueFromRow(fieldName, row);
    
    // Si la valeur est null ou undefined, retourner '-'
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    
    // Formater les dates
    if (fieldName.includes('date') || fieldName.includes('Date') || fieldName.includes('_at')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
      } catch (e) {
        // Si erreur de parsing, continuer
      }
    }
    
    // Utiliser la fonction formatCellValue existante pour formater
    const formatted = formatCellValue(value, fieldName, fieldSchema);
    return formatted.display || String(value);
  }, [getValueFromRow, formatCellValue]);

  // Fonction pour obtenir les colonnes importantes selon l'onglet
  const getImportantColumns = useCallback((tab: string): string[] => {
    const baseColumns = [
      'id',
      'provinceId', 'antenneId', 'zoneId', 'aireId',
      'nom', // Nom complet (nom + postnom + prenom combinés)
      'gender_i_c',
      'num_phone',
    ];
    
    // Colonnes spécifiques selon l'onglet - UN SEUL champ role (priorité: campaign_role_i_f > campaign_role > role > role_prestataire)
    let roleColumn = 'campaign_role_i_f'; // Priorité au champ campaign_role_i_f
    if (tab === 'validation') {
      return [
        ...baseColumns,
        roleColumn, // Un seul champ role
        'validation_status', // Priorité à validation_status (kyc_status sera mappé vers celui-ci)
        'validation_date' // Priorité à validation_date (validated_at sera mappé vers celui-ci)
      ];
    } else if (tab === 'approbation') {
      return [
        ...baseColumns,
        roleColumn, // Un seul champ role
        'approval_status',
        'approval_date', 'approved_at'
      ];
    } else if (tab === 'paiement') {
      return [
        ...baseColumns,
        roleColumn, // Un seul champ role
        'payment_status',
        'payment_date', 'paid_at'
      ];
    }
    
    return [];
  }, []);

  // Obtenir les colonnes à afficher selon l'onglet
  const getColumnsForTab = useCallback((tab: string): string[] => {
    if (tab === 'data') {
      // Pour DATA, utiliser toutes les colonnes comme avant
      const sortedFields = [...fields].sort((a, b) => {
        const orderA = schema?.properties?.[a]?.['x-order'] ?? 9999;
        const orderB = schema?.properties?.[b]?.['x-order'] ?? 9999;
        return orderA - orderB;
      });
      
      const systemColumns = {
        first: ['id'],
        last: ['status', 'kyc_status', 'approval_status', 'payment_status', 'created_at', 'updated_at']
      };
      
      const formFields = sortedFields.filter(f => 
        !systemColumns.first.includes(f.toLowerCase()) && 
        !systemColumns.last.includes(f.toLowerCase())
      );
      
      return [
        ...systemColumns.first.filter(f => sortedFields.some(ff => ff.toLowerCase() === f.toLowerCase())),
        ...formFields,
        ...systemColumns.last.filter(f => sortedFields.some(ff => ff.toLowerCase() === f.toLowerCase()))
      ];
    } else {
      // Pour les autres onglets, utiliser uniquement les colonnes importantes
      const importantCols = getImportantColumns(tab);
      // Filtrer pour ne garder que les colonnes qui existent dans le schéma ou dans les données
      // ET éviter les doublons (priorité: campaign_role_i_f)
      const filteredCols: string[] = [];
      const seenCols = new Set<string>();
      
      for (const col of importantCols) {
        // Éviter les doublons de colonnes role
        if (col === 'role' || col === 'campaign_role' || col === 'role_prestataire') {
          // Ne garder que campaign_role_i_f si présent
          if (importantCols.includes('campaign_role_i_f')) {
            continue; // Ignorer les autres variantes de role
          }
        }
        
        // Éviter les doublons de validation_status et kyc_status
        if (col === 'kyc_status') {
          // Ne garder que validation_status si présent
          if (importantCols.includes('validation_status')) {
            continue; // Ignorer kyc_status si validation_status est présent
          }
        }
        
        // Éviter les doublons de validation_date et validated_at
        if (col === 'validated_at') {
          // Ne garder que validation_date si présent
          if (importantCols.includes('validation_date')) {
            continue; // Ignorer validated_at si validation_date est présent
          }
        }
        
        // Éviter les doublons généraux (insensible à la casse)
        const colLower = col.toLowerCase();
        // Mapping des colonnes équivalentes pour éviter les doublons - garder UNE SEULE variante
        const equivalentCols: Record<string, string> = {
          'sexe': 'gender_i_c', // Garder sexe
          'telephone': 'num_phone', // Garder telephone
          'phone': 'telephone', // Mapper phone vers telephone
          'numero_telephone': 'telephone', // Mapper numero_telephone vers telephone
          'validation_status': 'validation_status', // Garder validation_status
          'kyc_status': 'validation_status', // Mapper kyc_status vers validation_status
          'validation_date': 'validation_date', // Garder validation_date
        };
        const normalizedCol = equivalentCols[colLower] || colLower;
        if (seenCols.has(normalizedCol)) continue;
        seenCols.add(normalizedCol);
        
        // Si c'est une variante mappée, utiliser la colonne principale
        const finalCol = equivalentCols[colLower] ? equivalentCols[colLower] : col;
        
        // Colonnes toujours incluses (nom complet, id, etc.)
        const alwaysInclude = ['id', 'nom', 'nom_complet'];
        if (alwaysInclude.includes(finalCol)) {
          filteredCols.push(finalCol);
          continue;
        }
        
        // Vérifier si la colonne existe dans le schéma
        if (schema?.properties?.[finalCol]) {
          filteredCols.push(finalCol);
          continue;
        }
        
        // Vérifier si la colonne existe dans les données (même si pas dans le schéma)
        // Pour les nouveaux onglets, toujours inclure les colonnes importantes même si pas trouvées
        const systemCols = ['id', 'provinceId', 'antenneId', 'zoneId', 'aireId', 'nom', 'nom_complet',
                           'sexe', 'telephone', 'campaign_role_i_f',
                           'validation_status', 'kyc_status', 
                           'approval_status', 'payment_status', 'validation_date', 
                           'approval_date', 'approved_at', 
                           'payment_date', 'paid_at'];
        
        if (systemCols.includes(finalCol)) {
          // Toujours inclure les colonnes système
          filteredCols.push(finalCol);
          continue;
        }
        
        if (allData.length > 0) {
          const firstRow = allData[0];
          // Utiliser getValueFromRow pour vérifier si la colonne existe
          const value = getValueFromRow(finalCol, firstRow);
          if (value !== null) {
            filteredCols.push(finalCol);
          }
        } else {
          // Par défaut, inclure la colonne si pas de données
          filteredCols.push(finalCol);
        }
      }
      
      return filteredCols;
    }
  }, [fields, schema, allData, getImportantColumns, findColumnName]);

  // Colonnes à afficher selon l'onglet actif (mémorisé pour éviter les re-renders)
  const orderedFields = useMemo(() => {
    if (!form || !publishedVersion) return [];
    return getColumnsForTab(activeTab);
  }, [activeTab, getColumnsForTab, form, publishedVersion]);

  // Initialiser les colonnes visibles pour les nouveaux onglets
  useEffect(() => {
    if (activeTab === 'validation' || activeTab === 'approbation' || activeTab === 'paiement') {
      // Pour les nouveaux onglets, afficher toutes les colonnes importantes
      setVisibleColumns(new Set(orderedFields));
    }
  }, [activeTab, orderedFields]);

  // Vérifications conditionnelles APRÈS tous les hooks
  if (loading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!form) {
    return <div className="text-center py-12">Formulaire non trouvé</div>;
  }

  if (!publishedVersion) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Ce formulaire n'est pas publié</p>
        <Link href={`/dashboard/forms/${form.id}/builder`} className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Aller au builder
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 break-words">{form.name}</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 break-words">{form.description}</p>
        </div>
        <Link
          href="/dashboard/forms"
          className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium whitespace-nowrap"
        >
          ← Retour aux formulaires
        </Link>
      </div>

      {/* Onglets */}
      <div className="mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto px-2 sm:px-4 md:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
          <button
            onClick={() => setActiveTab('summary')}
            className={`${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm`}
          >
            SOMMAIRE
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`${
              activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm`}
          >
            DATA
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`${
              activeTab === 'validation'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm`}
          >
            VALIDATION
          </button>
          <button
            onClick={() => setActiveTab('approbation')}
            className={`${
              activeTab === 'approbation'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm`}
          >
            APPROBATION
          </button>
          <button
            onClick={() => setActiveTab('paiement')}
            className={`${
              activeTab === 'paiement'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm`}
          >
            PAIEMENT
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-16">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Sommaire</h2>
          {statistics ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Total des soumissions</div>
                  <div className="text-2xl font-bold text-blue-600">{statistics.totalSubmissions}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Statistiques par champ</h3>
                {Object.entries(statistics.fields || {}).map(([fieldName, fieldStats]: [string, any]) => (
                  <div key={fieldName} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{fieldStats.label}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Type:</span>
                        <span className="ml-2 text-gray-900">{fieldStats.type}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <span className="ml-2 text-gray-900">{fieldStats.total}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Manquants:</span>
                        <span className="ml-2 text-gray-900">{fieldStats.missing}</span>
                      </div>
                      {fieldStats.options && (
                        <div>
                          <span className="text-gray-600">Options:</span>
                          <span className="ml-2 text-gray-900">{fieldStats.options.length}</span>
                        </div>
                      )}
                    </div>
                    {fieldStats.options && fieldStats.options.length > 0 && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Répartition:</h5>
                        <div className="space-y-2">
                          {fieldStats.options.map((opt: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span className="text-sm text-gray-900">{opt.value}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-32 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${opt.percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-600 w-16 text-right">
                                  {opt.count} ({opt.percentage}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(fieldStats.min !== undefined || fieldStats.mean !== undefined) && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {fieldStats.min !== undefined && (
                          <div>
                            <span className="text-gray-600">Min:</span>
                            <span className="ml-2 text-gray-900">{fieldStats.min}</span>
                          </div>
                        )}
                        {fieldStats.max !== undefined && (
                          <div>
                            <span className="text-gray-600">Max:</span>
                            <span className="ml-2 text-gray-900">{fieldStats.max}</span>
                          </div>
                        )}
                        {fieldStats.mean !== undefined && (
                          <div>
                            <span className="text-gray-600">Moyenne:</span>
                            <span className="ml-2 text-gray-900">{fieldStats.mean}</span>
                          </div>
                        )}
                        {fieldStats.median !== undefined && (
                          <div>
                            <span className="text-gray-600">Médiane:</span>
                            <span className="ml-2 text-gray-900">{fieldStats.median}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">Chargement des statistiques...</div>
          )}
        </div>
      )}

      {/* Composant de tableau réutilisable pour les nouveaux onglets */}
      {(activeTab === 'validation' || activeTab === 'approbation' || activeTab === 'paiement') && (
        <div className="bg-white rounded-lg shadow w-full">
          {/* En-tête avec résultats et boutons */}
          <div className="p-2 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-600">
              {total > 0 ? (
                <>
                  {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} / {total} résultats
                </>
              ) : (
                'Aucun résultat'
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
              <select
                value={selectedCampaignId}
                onChange={(e) => {
                  setSelectedCampaignId(e.target.value);
                  setPage(1); // Reset à la première page
                }}
                className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes les campagnes</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleExport}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs sm:text-sm font-medium flex-1 sm:flex-initial"
              >
                <span className="hidden sm:inline">Exporter</span>
                <span className="sm:hidden">Exp</span>
              </button>
            </div>
          </div>

          {/* Table de données */}
          {loadingData ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">Chargement des données...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">Aucune donnée disponible</div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        {orderedFields.map((fieldName, colIndex) => {
                          // Obtenir le label de la colonne
                          let columnLabel = fieldName;
                          if (fieldName === 'nom' || fieldName === 'nom_complet') {
                            columnLabel = 'Nom complet';
                          } else if (fieldName === 'provinceId') {
                            columnLabel = 'Province';
                          } else if (fieldName === 'antenneId') {
                            columnLabel = 'Antenne';
                          } else if (fieldName === 'zoneId') {
                            columnLabel = 'Zone de santé';
                          } else if (fieldName === 'aireId') {
                            columnLabel = 'Aire de santé';
                          } else if (fieldName === 'telephone' || fieldName === 'phone' || fieldName === 'numero_telephone') {
                            columnLabel = 'Téléphone';
                          } else if (fieldName === 'sexe' || fieldName === 'sex') {
                            columnLabel = 'Sexe';
                          } else if (fieldName === 'campaign_role_i_f') {
                            columnLabel = 'Rôle pendant la campagne';
                          } else if (fieldName === 'role' || fieldName === 'campaign_role' || fieldName === 'role_prestataire') {
                            columnLabel = 'Rôle';
                          } else if (fieldName === 'validation_status' || fieldName === 'kyc_status') {
                            columnLabel = 'Status validation';
                          } else if (fieldName === 'approval_status') {
                            columnLabel = 'Status approbation';
                          } else if (fieldName === 'payment_status') {
                            columnLabel = 'Status paiement';
                          } else if (fieldName === 'validation_date' || fieldName === 'validated_at') {
                            columnLabel = 'Date validation';
                          } else if (fieldName === 'approval_date' || fieldName === 'approved_at') {
                            columnLabel = 'Date approbation';
                          } else if (fieldName === 'payment_date' || fieldName === 'paid_at') {
                            columnLabel = 'Date paiement';
                          } else {
                            const fieldSchema = schema?.properties?.[fieldName];
                            columnLabel = fieldSchema?.title || fieldName;
                          }

                          return (
                            <th 
                              key={fieldName} 
                              className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative"
                              style={{ minWidth: '100px', position: 'relative', userSelect: 'none' }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="whitespace-normal break-words leading-tight">{columnLabel}</span>
                                {colIndex < orderedFields.length - 1 && (
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-300 bg-transparent"
                                    style={{ right: '-2px' }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const th = e.currentTarget.parentElement?.parentElement as HTMLElement;
                                      if (!th) return;
                                      
                                      const startX = e.pageX;
                                      const startWidth = th.offsetWidth;
                                      
                                      const handleMouseMove = (moveEvent: MouseEvent) => {
                                        const diff = moveEvent.pageX - startX;
                                        const newWidth = Math.max(100, startWidth + diff);
                                        th.style.width = `${newWidth}px`;
                                        th.style.minWidth = `${newWidth}px`;
                                        
                                        // Appliquer la même largeur à toutes les cellules de cette colonne
                                        const colIndex = Array.from(th.parentElement?.children || []).indexOf(th);
                                        const table = th.closest('table');
                                        if (table) {
                                          const cells = table.querySelectorAll(`tbody tr td:nth-child(${colIndex + 1})`);
                                          cells.forEach((cell: any) => {
                                            cell.style.width = `${newWidth}px`;
                                            cell.style.minWidth = `${newWidth}px`;
                                          });
                                        }
                                      };
                                      
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.map((row, idx) => (
                        <tr key={`${row.id || row.submissionId || 'row'}-${idx}`} className="hover:bg-gray-50">
                          {orderedFields.map((fieldName) => {
                            const fieldSchema = schema?.properties?.[fieldName];
                            const cellValue = formatSpecialCell(fieldName, row, fieldSchema);
                            
                            return (
                              <td 
                                key={fieldName} 
                                className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900"
                                style={{ minWidth: '100px', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                title={cellValue}
                              >
                                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                                  <span className="block min-w-0 break-words">{cellValue}</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="px-2 sm:px-4 py-2 sm:py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">◄ PRÉCÉDENT</span>
                  <span className="sm:hidden">◄ PRÉC</span>
                </button>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
                  <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    Page {page} de {Math.ceil(total / limit)}
                  </span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="text-xs sm:text-sm border rounded-md px-1 sm:px-2 py-1"
                  >
                    <option value={30}>30 lignes</option>
                    <option value={50}>50 lignes</option>
                    <option value={100}>100 lignes</option>
                  </select>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">SUIVANT ►</span>
                  <span className="sm:hidden">SUIV ►</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'data' && (
        <div className="bg-white rounded-lg shadow w-full">
          {/* En-tête avec résultats et boutons */}
          <div className="p-2 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <div className="text-xs sm:text-sm text-gray-600">
              {total > 0 ? (
                <>
                  {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} / {total} résultats
                </>
              ) : (
                'Aucun résultat'
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
              <button
                onClick={() => setShowColumnModal(true)}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 flex-1 sm:flex-initial"
                title="Filtrer les colonnes à afficher"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="hidden sm:inline">Filtre</span>
              </button>
              <button
                onClick={handleExport}
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs sm:text-sm font-medium flex-1 sm:flex-initial"
              >
                <span className="hidden sm:inline">Exporter</span>
                <span className="sm:hidden">Exp</span>
              </button>
              <button
                className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs sm:text-sm font-medium"
                title="Plein écran"
              >
                ⛶
              </button>
            </div>
          </div>

          {/* Table de données */}
          {loadingData ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">Chargement des données...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">Aucune donnée disponible</div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                          <div className="flex flex-col gap-1 sm:gap-2">
                            <span className="whitespace-nowrap">ID</span>
                          </div>
                        </th>
                        {orderedFields.filter(fieldName => visibleColumns.has(fieldName)).map((fieldName) => {
                          const fieldSchema = schema?.properties?.[fieldName];
                          const isSelect = isSelectField(fieldSchema, fieldName);
                          const uniqueValues = isSelect ? getUniqueValues(fieldName) : [];
                          const currentFilter = filters[fieldName];
                          const selectedValues = Array.isArray(currentFilter) ? currentFilter : (currentFilter ? [currentFilter] : []);
                          
                          return (
                            <th key={fieldName} className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                              <div className="flex flex-col gap-1 sm:gap-2">
                                <span className="whitespace-normal break-words leading-tight text-[10px] sm:text-xs">{fieldSchema?.title || fieldName}</span>
                              {isSelect && uniqueValues.length > 0 ? (
                                <div className="relative dropdown-container">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdowns((prev) => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(fieldName)) {
                                          newSet.delete(fieldName);
                                        } else {
                                          newSet.add(fieldName);
                                        }
                                        return newSet;
                                      });
                                    }}
                                    className="text-[10px] sm:text-xs border rounded px-1 sm:px-2 py-0.5 sm:py-1 w-full text-left bg-white hover:bg-gray-50 flex items-center justify-between"
                                  >
                                    <span className="truncate text-[10px] sm:text-xs">
                                      {selectedValues.length === 0
                                        ? 'Sélectionner...'
                                        : selectedValues.length === 1
                                        ? (() => {
                                            const item = getUniqueValuesWithLabels(fieldName).find(item => item.value === selectedValues[0]);
                                            return item?.label || selectedValues[0];
                                          })()
                                        : `${selectedValues.length} sélectionné(s)`}
                                    </span>
                                    <svg
                                      className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ${openDropdowns.has(fieldName) ? 'rotate-180' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {selectedValues.length > 0 && (
                                      <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-blue-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center flex-shrink-0">
                                        {selectedValues.length}
                                      </span>
                                    )}
                                  </button>
                                  {openDropdowns.has(fieldName) && (
                                    <div 
                                      className="absolute z-50 mt-1 w-full sm:w-auto min-w-full sm:min-w-[200px] bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto dropdown-container"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="p-1 sm:p-2 space-y-1">
                                        {getUniqueValuesWithLabels(fieldName).map((item) => {
                                          const isSelected = selectedValues.includes(item.value);
                                          return (
                                            <label
                                              key={item.value}
                                              className="flex items-center px-1 sm:px-2 py-0.5 sm:py-1 hover:bg-gray-100 rounded cursor-pointer"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // Ne pas fermer le dropdown quand on clique sur une checkbox
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  const newSelected = e.target.checked
                                                    ? [...selectedValues, item.value]
                                                    : selectedValues.filter((v) => v !== item.value);
                                                  handleMultiSelectChange(fieldName, newSelected);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                              />
                                              <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs text-gray-900 cursor-pointer break-words">{item.label}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Recherche"
                                  className="text-[10px] sm:text-xs border rounded px-1 sm:px-2 py-0.5 sm:py-1 w-full"
                                  onChange={(e) => handleFilterChange(fieldName, e.target.value)}
                                  value={typeof currentFilter === 'string' ? currentFilter : ''}
                                />
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((row, idx) => (
                      <tr key={`${row.id || row.submissionId || 'row'}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-mono sticky left-0 bg-white z-10">
                          {row.id || row.submissionId || '-'}
                        </td>
                        {orderedFields.filter(fieldName => visibleColumns.has(fieldName)).map((fieldName) => {
                          const fieldSchema = schema?.properties?.[fieldName];
                          // Trouver le nom de colonne réel dans les données
                          const realColumnName = findColumnName(fieldName, row) || fieldName;
                          const formatted = formatCellValue(row[realColumnName], fieldName, fieldSchema);
                          return (
                            <td 
                              key={fieldName} 
                              className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 max-w-[150px] sm:max-w-xs"
                              title={formatted.fullValue || undefined}
                            >
                              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                                {formatted.isImage && (
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                )}
                                <span className={`truncate block min-w-0 ${formatted.isImage ? 'font-mono text-[10px] sm:text-xs' : ''}`}>
                                  {formatted.display}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="px-2 sm:px-4 py-2 sm:py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">◄ PRÉCÉDENT</span>
                  <span className="sm:hidden">◄ PRÉC</span>
                </button>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
                  <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    Page {page} de {Math.ceil(total / limit)}
                  </span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="text-xs sm:text-sm border rounded-md px-1 sm:px-2 py-1"
                  >
                    <option value={30}>30 lignes</option>
                    <option value={50}>50 lignes</option>
                    <option value={100}>100 lignes</option>
                  </select>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">SUIVANT ►</span>
                  <span className="sm:hidden">SUIV ►</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Modal de sélection des colonnes */}
      {showColumnModal && form && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={handleCancelColumnSelection}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">Filtrer les variables à afficher</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">Sélectionnez les questions/variables que vous souhaitez voir dans le tableau de données</p>
                </div>
                {publishedVersion && (
                  <div className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                    <span className="font-medium text-blue-600">{visibleColumns.size}</span> / {fields.length} sélectionnées
                  </div>
                )}
              </div>
            </div>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1">
              {publishedVersion && (
                <>
                  <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleSelectAllColumns}
                      className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                    >
                      Tout sélectionner
                    </button>
                    <button
                      onClick={handleDeselectAllColumns}
                      className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100"
                    >
                      Tout désélectionner
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[50vh] sm:max-h-96 overflow-y-auto">
                    {orderedFields.map((fieldName) => {
                      const fieldSchema = schema?.properties?.[fieldName];
                      const fieldTitle = fieldSchema?.title || fieldName;
                      const fieldType = fieldSchema?.type || 'string';
                      const isVisible = visibleColumns.has(fieldName);
                      return (
                        <label
                          key={fieldName}
                          className={`flex items-start p-2 sm:p-3 rounded-md cursor-pointer border ${
                            isVisible 
                              ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => handleToggleColumn(fieldName)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5 flex-shrink-0"
                          />
                          <div className="ml-2 sm:ml-3 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span className="text-xs sm:text-sm font-medium text-gray-900 break-words">{fieldTitle}</span>
                              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-gray-100 text-gray-600 rounded whitespace-nowrap">
                                {fieldType}
                              </span>
                            </div>
                            <span className="text-[10px] sm:text-xs text-gray-500 mt-1 block break-all">{fieldName}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="p-3 sm:p-4 md:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={handleCancelColumnSelection}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveColumnSelection}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

