import 'package:flutter/material.dart';
import '../models/prestataire.dart';
import '../models/campaign.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class SentSubmissionsScreen extends StatefulWidget {
  const SentSubmissionsScreen({super.key});

  @override
  State<SentSubmissionsScreen> createState() => _SentSubmissionsScreenState();
}

class _SentSubmissionsScreenState extends State<SentSubmissionsScreen> {
  List<Prestataire> _prestataires = [];
  List<Campaign> _campaigns = [];
  bool _isLoading = true;
  bool _isLoadingCampaigns = false;
  final Map<String, TextEditingController> _presenceDaysControllers = {};
  final Map<String, DateTime?> _validationDates = {};
  final Map<String, String?> _selectedCampaignIds = {};
  final Map<String, List<Map<String, dynamic>>> _prestataireValidations = {};
  final ApiService _apiService = ApiService();
  String? _formId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCampaigns();
      _loadData();
    });
  }

  Future<void> _loadCampaigns() async {
    setState(() {
      _isLoadingCampaigns = true;
    });

    try {
      final campaigns = await _apiService.getCampaigns();
      setState(() {
        _campaigns = campaigns;
        _isLoadingCampaigns = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingCampaigns = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors du chargement des campagnes: $e'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    // Dispose all controllers
    for (var controller in _presenceDaysControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Récupérer le formId depuis la campagne active
      String? formId = _formId;
      if (formId == null) {
        try {
          final campaigns = await _apiService.getCampaigns();
          Campaign? activeCampaign;
          try {
            activeCampaign = campaigns.firstWhere((c) => c.isActive);
          } catch (e) {
            if (campaigns.isNotEmpty) {
              activeCampaign = campaigns.first;
            }
          }
          if (activeCampaign != null && activeCampaign.enregistrementFormId != null) {
            formId = activeCampaign.enregistrementFormId;
            _formId = formId;
          }
        } catch (e) {
          print('Erreur lors de la récupération de la campagne: $e');
        }
      }

      // Récupérer les prestataires depuis la table du formulaire
      // Utiliser getPrestatairesByForm avec includeValidations=true pour récupérer TOUS les prestataires
      // y compris les validations pour différentes campagnes
      List<Map<String, dynamic>> data;
      if (formId != null) {
        // IMPORTANT: includeValidations=true pour récupérer toutes les validations pour toutes les campagnes
        final result = await _apiService.getPrestatairesByForm(formId, limit: 1000, includeValidations: true);
        data = List<Map<String, dynamic>>.from(result['data'] ?? []);
        print('DEBUG: Récupéré ${data.length} prestataires avec validations (includeValidations=true)');
      } else {
        // Si pas de formId, utiliser getPrestatairesPendingValidation comme fallback
        data = await _apiService.getPrestatairesPendingValidation();
      }
      
      // Récupérer l'utilisateur connecté pour filtrer par aireId
      final authService = AuthService(_apiService);
      User? currentUser;
      String? userAireId;
      String? userId;
      try {
        currentUser = await authService.getCurrentUser();
        userAireId = currentUser?.aireId;
        userId = currentUser?.id;
        print('DEBUG SENT: Utilisateur connecté - role=${currentUser?.role}, aireId=$userAireId, userId=$userId');
      } catch (e) {
        print('DEBUG SENT: Erreur lors de la récupération de l\'utilisateur: $e');
      }

      // Créer les prestataires et récupérer les informations de validation depuis le JSON original
      final prestataires = <Prestataire>[];
      final prestataireIdsSet = <String>{}; // Pour éviter les doublons
      final validationSequences = <String, int>{}; // Map pour stocker les séquences de validation par prestataire ID
      
      for (var json in data) {
        final prestataire = Prestataire.fromJson(json);
        
        // Utiliser prestataireId si disponible (ID réel du prestataire), sinon utiliser id
        final prestataireRealId = prestataire.prestataireId ?? prestataire.id;
        
        // Pour les utilisateurs IT, filtrer par aireId avant de traiter le prestataire
        if (currentUser?.role == 'IT' && userAireId != null && userAireId.isNotEmpty) {
          // Vérifier l'aireId du prestataire
          final prestataireAireId = prestataire.aireId ?? 
                                   json['aireId']?.toString() ?? 
                                   json['aire_id']?.toString() ?? 
                                   json['aire_de_sante_id']?.toString();
          
          // Vérifier aussi enregistrePar pour s'assurer que le prestataire a été enregistré par cet IT
          final enregistrePar = json['enregistrePar']?.toString() ?? 
                               json['enregistre_par']?.toString() ?? 
                               json['created_by']?.toString();
          
          // Normaliser les IDs pour la comparaison (enlever espaces, convertir en minuscules)
          final normalizeId = (String? id) => id?.trim().toLowerCase() ?? '';
          final userAireIdNormalized = normalizeId(userAireId);
          final prestataireAireIdNormalized = normalizeId(prestataireAireId);
          final enregistreParNormalized = normalizeId(enregistrePar);
          final userIdNormalized = normalizeId(userId);
          
          // Inclure seulement si l'aireId correspond OU si enregistré par cet IT
          final matchesAire = prestataireAireIdNormalized == userAireIdNormalized;
          final matchesEnregistrePar = enregistreParNormalized == userIdNormalized;
          
          if (!matchesAire && !matchesEnregistrePar) {
            print('DEBUG SENT: Prestataire ${prestataireRealId} ignoré - aireId=$prestataireAireId (attendu: $userAireId), enregistrePar=$enregistrePar (attendu: $userId)');
            continue;
          }
          
          print('DEBUG SENT: Prestataire ${prestataireRealId} inclus - aireId=$prestataireAireId, enregistrePar=$enregistrePar');
        }
        
        // Éviter les doublons : ne garder qu'un seul enregistrement par prestataire
        // Prioriser l'enregistrement original (validation_sequence IS NULL) ou la validation la plus récente
        if (prestataireIdsSet.contains(prestataireRealId)) {
          // Vérifier si cet enregistrement est plus récent ou a plus d'informations
          final existingIndex = prestataires.indexWhere((p) => (p.prestataireId ?? p.id) == prestataireRealId);
          if (existingIndex >= 0) {
            final existingSeq = json['validation_sequence'] as int? ?? 0;
            final currentSeq = validationSequences[prestataireRealId] ?? 0;
            
            // Si le nouveau a un validation_sequence plus élevé, remplacer l'existant
            if (existingSeq > currentSeq) {
              prestataires[existingIndex] = prestataire;
              validationSequences[prestataireRealId] = existingSeq;
            }
          }
          continue;
        }
        
        prestataireIdsSet.add(prestataireRealId);
        prestataires.add(prestataire);
        // Stocker la séquence de validation pour ce prestataire
        validationSequences[prestataireRealId] = json['validation_sequence'] as int? ?? 0;
        
        // Récupérer les informations de validation directement depuis le JSON original
        // Le backend retourne ces champs comme colonnes directes (pas dans raw_data)
        final prestataireId = prestataire.id;
        
        // Initialiser le contrôleur pour les jours de présence
        if (!_presenceDaysControllers.containsKey(prestataireId)) {
          // Chercher presenceDays dans le JSON original (peut être presenceDays ou presence_days)
          final presenceDays = json['presenceDays'] ?? json['presence_days'];
          _presenceDaysControllers[prestataireId] = TextEditingController(
            text: presenceDays?.toString() ?? prestataire.presenceDays?.toString() ?? '',
          );
        }
        
        // Récupérer la date de validation depuis le JSON original
        if (!_validationDates.containsKey(prestataireId)) {
          DateTime? validationDate;
          
          // Chercher validationDate ou validation_date dans le JSON original
          final validationDateStr = json['validationDate'] ?? json['validation_date'];
          if (validationDateStr != null) {
            try {
              validationDate = DateTime.parse(validationDateStr.toString());
            } catch (e) {
              // Ignorer les erreurs de parsing
            }
          }
          
          // Si pas trouvé, chercher dans enregistrementData comme fallback
          if (validationDate == null && prestataire.enregistrementData != null) {
            final enregistrementData = prestataire.enregistrementData!;
            final dateStr = enregistrementData['validationDate'] ?? enregistrementData['validation_date'];
            if (dateStr != null) {
              try {
                validationDate = DateTime.parse(dateStr.toString());
              } catch (e) {
                // Ignorer les erreurs de parsing
              }
            }
          }
          
          if (validationDate != null) {
            _validationDates[prestataireId] = validationDate;
          }
        }
        
        // Récupérer la campagne depuis le JSON original ou le prestataire
        if (!_selectedCampaignIds.containsKey(prestataireId)) {
          final campaignId = json['campaignId'] ?? json['campaign_id'] ?? prestataire.campaignId;
          if (campaignId != null && campaignId.toString().isNotEmpty) {
            _selectedCampaignIds[prestataireId] = campaignId.toString();
          }
        }
      }

      // Charger l'historique des validations pour TOUS les prestataires
      // Cela permet d'afficher toutes les validations, même pour différentes campagnes
      for (var prestataire in prestataires) {
        try {
          // Utiliser prestataireId si disponible (ID réel du prestataire), sinon utiliser id
          final prestataireRealId = prestataire.prestataireId ?? prestataire.id;
          final validations = await _apiService.getPrestataireValidations(prestataireRealId);
          _prestataireValidations[prestataire.id] = validations;
          print('DEBUG: Chargé ${validations.length} validations pour prestataire ${prestataireRealId}');
          
          // Récupérer les informations de validation depuis l'historique pour toutes les campagnes
          // Mettre à jour _validationDates et _presenceDaysControllers avec les informations de toutes les validations
          for (var validation in validations) {
            // Vérifier si c'est une validation (avec parent_submission_id)
            if (validation['parent_submission_id'] != null && 
                validation['parent_submission_id'].toString().isNotEmpty) {
              final validationCampaignId = validation['campaign_id']?.toString() ?? validation['campaignId']?.toString();
              final validationDateStr = validation['validation_date'] ?? validation['validationDate'];
              final presenceDays = validation['presence_days'] ?? validation['presenceDays'];
              
              // Si c'est la validation la plus récente ou si on n'a pas encore de date pour cette campagne
              if (validationDateStr != null) {
                try {
                  final validationDate = DateTime.parse(validationDateStr.toString());
                  // Utiliser la clé prestataireId_campaignId pour stocker les informations par campagne
                  final key = '${prestataire.id}_${validationCampaignId ?? 'default'}';
                  if (!_validationDates.containsKey(key) || 
                      _validationDates[key] == null ||
                      validationDate.isAfter(_validationDates[key]!)) {
                    _validationDates[key] = validationDate;
                  }
                } catch (e) {
                  print('DEBUG: Erreur parsing date de validation: $e');
                }
              }
              
              // Stocker les jours de présence par campagne
              if (presenceDays != null) {
                final key = '${prestataire.id}_${validationCampaignId ?? 'default'}';
                if (!_presenceDaysControllers.containsKey(key)) {
                  _presenceDaysControllers[key] = TextEditingController(
                    text: presenceDays.toString(),
                  );
                }
              }
            }
          }
        } catch (e) {
          // Ignorer les erreurs de chargement de l'historique
          _prestataireValidations[prestataire.id] = [];
          print('DEBUG: Erreur lors du chargement des validations pour ${prestataire.id}: $e');
        }
      }

      setState(() {
        _prestataires = prestataires;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors du chargement: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _validatePrestataire(Prestataire prestataire) async {
    final controller = _presenceDaysControllers[prestataire.id];
    final presenceDaysText = controller?.text.trim() ?? '';
    
    if (presenceDaysText.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Veuillez saisir le nombre de jours de présence'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final presenceDays = int.tryParse(presenceDaysText);
    if (presenceDays == null || presenceDays < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Le nombre de jours doit être un nombre positif'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Vérifier que la date de validation est sélectionnée
    final validationDate = _validationDates[prestataire.id];
    if (validationDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Veuillez sélectionner la date de validation'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Vérifier que la campagne est sélectionnée
    final campaignId = _selectedCampaignIds[prestataire.id];
    if (campaignId == null || campaignId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Veuillez sélectionner une campagne'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      // Utiliser prestataireId si disponible (ID réel du prestataire), sinon utiliser id
      final prestataireRealId = prestataire.prestataireId ?? prestataire.id;
      await _apiService.validatePrestataire(
        prestataireRealId, 
        presenceDays,
        validationDate: validationDate,
        campaignId: campaignId,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prestataire validé avec succès'),
            backgroundColor: Colors.green,
          ),
        );
        // Recharger les données et l'historique
        await _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de la validation: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _invalidatePrestataire(Prestataire prestataire) async {
    // Demander confirmation
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Invalider le prestataire'),
        content: Text('Êtes-vous sûr de vouloir invalider le prestataire ${prestataire.id} ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Annuler'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Invalider'),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    try {
      // Utiliser prestataireId si disponible (ID réel du prestataire), sinon utiliser id
      final prestataireRealId = prestataire.prestataireId ?? prestataire.id;
      
      // Récupérer le formId depuis la campagne si disponible
      String? formId = _formId;
      if (formId == null && prestataire.campaignId != null) {
        try {
          final campaign = _campaigns.firstWhere(
            (c) => c.id == prestataire.campaignId,
            orElse: () => _campaigns.firstWhere(
              (c) => c.enregistrementFormId != null,
              orElse: () => _campaigns.first,
            ),
          );
          formId = campaign.enregistrementFormId;
        } catch (e) {
          // Si on ne trouve pas de campagne, essayer de récupérer depuis les campagnes chargées
          if (_campaigns.isNotEmpty) {
            final campaign = _campaigns.firstWhere(
              (c) => c.enregistrementFormId != null,
              orElse: () => _campaigns.first,
            );
            formId = campaign.enregistrementFormId;
          }
        }
      }
      
      await _apiService.invalidatePrestataire(prestataireRealId, formId: formId);
      
      // Supprimer la date de validation et la campagne locale
      _validationDates.remove(prestataire.id);
      _selectedCampaignIds.remove(prestataire.id);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Prestataire invalidé avec succès'),
            backgroundColor: Colors.orange,
          ),
        );
        // Recharger les données
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur lors de l\'invalidation: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Valider présence',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Actualiser',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _prestataires.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.check_circle_outline,
                        size: 64,
                        color: Colors.grey.shade400,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Aucun prestataire à valider',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Les prestataires enregistrés apparaîtront ici',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey.shade500,
                            ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: ListView.builder(
                    itemCount: _prestataires.length,
                    padding: const EdgeInsets.all(8),
                    itemBuilder: (context, index) {
                      final prestataire = _prestataires[index];
                      return _buildPrestataireCard(context, prestataire);
                    },
                  ),
                ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  String? _getValidCampaignValue(String prestataireId) {
    final selectedCampaignId = _selectedCampaignIds[prestataireId];
    // Vérifier que la valeur sélectionnée existe dans la liste des campagnes
    if (selectedCampaignId != null && 
        selectedCampaignId.isNotEmpty &&
        _campaigns.any((campaign) => campaign.id == selectedCampaignId)) {
      return selectedCampaignId;
    }
    // Si la valeur n'existe pas dans la liste ou si la liste est vide, retourner null
    // Le DropdownButton gérera automatiquement l'affichage du placeholder
    return null;
  }

  Widget _buildPrestataireCard(BuildContext context, Prestataire prestataire) {
    final isValidated = prestataire.status == 'VALIDE_PAR_IT';
    final controller = _presenceDaysControllers[prestataire.id] ?? 
                      TextEditingController(text: prestataire.presenceDays?.toString() ?? '');
    
    if (!_presenceDaysControllers.containsKey(prestataire.id)) {
      _presenceDaysControllers[prestataire.id] = controller;
    }

    // Construire le nom complet en une ligne
    final fullName = '${prestataire.prenom} ${prestataire.nom}${prestataire.postnom != null ? " ${prestataire.postnom}" : ""}';
    
    // Afficher les informations de validation si elles existent (même si le prestataire n'est pas actuellement validé)
    // Cela permet à l'IT de voir s'il a déjà validé ce prestataire pour n'importe quelle campagne
    final validations = _prestataireValidations[prestataire.id] ?? [];
    final hasValidationInfo = isValidated || 
                             prestataire.presenceDays != null || 
                             _validationDates.containsKey(prestataire.id) ||
                             prestataire.campaignId != null ||
                             validations.isNotEmpty;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: InkWell(
        onTap: () => _showValidationDialog(context, prestataire),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Affichage simplifié : ID et nom complet en une ligne
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${prestataire.id} - $fullName',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ),
                  if (isValidated) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.cancel, color: Colors.red),
                      onPressed: () => _invalidatePrestataire(prestataire),
                      tooltip: 'Invalider',
                      iconSize: 24,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ],
              ),
              // Afficher les informations de validation si elles existent
              if (hasValidationInfo) ...[
                const SizedBox(height: 8),
                _buildValidationsHistory(context, prestataire),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _getCampaignName(String? campaignId) {
    if (campaignId == null) return 'N/A';
    final campaign = _campaigns.firstWhere(
      (c) => c.id == campaignId,
      orElse: () => Campaign(
        id: '',
        name: 'N/A',
        isActive: false,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    );
    return campaign.name;
  }

  Widget _buildValidationsHistory(BuildContext context, Prestataire prestataire) {
    final isValidated = prestataire.status == 'VALIDE_PAR_IT';
    final validations = _prestataireValidations[prestataire.id] ?? [];
    
    // Filtrer seulement les validations (avec parent_submission_id)
    final validationRecords = validations.where((v) => 
      v['parent_submission_id'] != null && 
      v['parent_submission_id'].toString().isNotEmpty
    ).toList();

    // Si pas de validations dans l'historique, chercher dans toutes les validations (y compris l'enregistrement original)
    // pour trouver les informations de validation pour toutes les campagnes
    if (validationRecords.isEmpty) {
      // Chercher dans toutes les validations (y compris l'enregistrement original si validé)
      final allValidations = validations.where((v) => 
        (v['status']?.toString().toUpperCase() == 'VALIDE_PAR_IT' ||
         v['validation_status']?.toString().toUpperCase() == 'VALIDE_PAR_IT') &&
        (v['validation_date'] != null || v['validationDate'] != null)
      ).toList();
      
      if (allValidations.isNotEmpty) {
        // Afficher toutes les validations trouvées
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isValidated) ...[
              Text(
                'Statut: Validé',
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.green.shade400,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
            ],
            ...allValidations.map((validation) {
              final validationDateStr = validation['validation_date'] ?? validation['validationDate'];
              final campaignId = validation['campaign_id']?.toString() ?? validation['campaignId']?.toString();
              final presenceDays = validation['presence_days'] ?? validation['presenceDays'];
              
              DateTime? validationDate;
              if (validationDateStr != null) {
                try {
                  validationDate = DateTime.parse(validationDateStr.toString());
                } catch (e) {
                  // Ignorer
                }
              }
              
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (validationDate != null) ...[
                    Text(
                      'Date de validation: ${_formatDate(validationDate)}',
                      style: TextStyle(
                        fontSize: 10,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                    const SizedBox(height: 2),
                  ],
                  if (campaignId != null && campaignId.isNotEmpty) ...[
                    Text(
                      'Campagne: ${_getCampaignName(campaignId)}',
                      style: TextStyle(
                        fontSize: 10,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                    const SizedBox(height: 2),
                  ],
                  if (presenceDays != null) ...[
                    Text(
                      'Jours de présence: $presenceDays',
                      style: TextStyle(
                        fontSize: 10,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                    const SizedBox(height: 2),
                  ],
                ],
              );
            }).toList(),
          ],
        );
      }
      
      // Fallback: Afficher les informations de validation depuis le prestataire
      // Récupérer les valeurs depuis les controllers et maps
      final presenceDays = prestataire.presenceDays ?? 
                          (_presenceDaysControllers[prestataire.id]?.text.isNotEmpty == true
                            ? int.tryParse(_presenceDaysControllers[prestataire.id]!.text)
                            : null);
      final validationDate = _validationDates[prestataire.id];
      final campaignId = _selectedCampaignIds[prestataire.id] ?? prestataire.campaignId;
      
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isValidated) ...[
            Text(
              'Statut: Validé',
              style: TextStyle(
                fontSize: 11,
                color: Colors.green.shade400,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 2),
          ],
          if (validationDate != null) ...[
            Text(
              'Date de validation: ${_formatDate(validationDate)}',
              style: TextStyle(
                fontSize: 10,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
              ),
            ),
            const SizedBox(height: 2),
          ],
          if (campaignId != null && campaignId.isNotEmpty) ...[
            Text(
              'Campagne: ${_getCampaignName(campaignId)}',
              style: TextStyle(
                fontSize: 10,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
              ),
            ),
            const SizedBox(height: 2),
          ],
          if (presenceDays != null) ...[
            Text(
              'Jours de présence: $presenceDays',
              style: TextStyle(
                fontSize: 10,
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
              ),
            ),
          ],
        ],
      );
    }

    // Afficher toutes les validations
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Historique des validations (${validationRecords.length})',
          style: TextStyle(
            fontSize: 11,
            color: Colors.green.shade400,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        ...validationRecords.map((validation) {
          final validationDate = validation['validation_date'] != null
              ? DateTime.tryParse(validation['validation_date'].toString())
              : null;
          final campaignId = validation['campaign_id']?.toString();
          final presenceDays = validation['presence_days']?.toString() ?? '0';
          
          return Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface.withOpacity(0.5),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: Theme.of(context).colorScheme.primary.withOpacity(0.3),
                width: 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      size: 14,
                      color: Colors.green.shade400,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        'Campagne: ${_getCampaignName(campaignId)}',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Date: ${validationDate != null ? _formatDate(validationDate) : 'N/A'}',
                  style: TextStyle(
                    fontSize: 9,
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Jours: $presenceDays',
                  style: TextStyle(
                    fontSize: 9,
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  void _showValidationDialog(BuildContext context, Prestataire prestataire) {
    // Pré-remplir avec les valeurs existantes si le prestataire est déjà validé
    String? selectedCampaignId = _selectedCampaignIds[prestataire.id] ?? prestataire.campaignId;
    DateTime? selectedDate = _validationDates[prestataire.id];
    
    // Si pas de date dans _validationDates, essayer de la récupérer depuis enregistrementData
    if (selectedDate == null && prestataire.enregistrementData != null) {
      final data = prestataire.enregistrementData!;
      if (data['validationDate'] != null || data['validation_date'] != null) {
        try {
          final dateStr = data['validationDate']?.toString() ?? data['validation_date']?.toString();
          if (dateStr != null) {
            selectedDate = DateTime.parse(dateStr);
          }
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }
    }
    
    final presenceDaysController = TextEditingController(
      text: prestataire.presenceDays?.toString() ?? '',
    );
    
    // Si le prestataire est déjà validé, changer le titre du dialog
    final isValidated = prestataire.status == 'VALIDE_PAR_IT';
    final dialogTitle = isValidated ? 'Modifier la validation' : 'Valider présence';

    showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Theme.of(context).colorScheme.surface,
          title: Text(
            dialogTitle,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ID
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Text(
                        'ID: ',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      Text(
                        prestataire.id,
                        style: TextStyle(
                          fontFamily: 'monospace',
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
                // Campagne
                if (!_isLoadingCampaigns && _campaigns.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: DropdownButtonFormField<String>(
                      value: selectedCampaignId != null && 
                             _campaigns.any((c) => c.id == selectedCampaignId)
                          ? selectedCampaignId
                          : null,
                      decoration: InputDecoration(
                        labelText: 'Campagne',
                        border: const OutlineInputBorder(),
                        prefixIcon: const Icon(Icons.campaign),
                        isDense: true,
                      ),
                      items: _campaigns.map((campaign) {
                        return DropdownMenuItem<String>(
                          value: campaign.id,
                          child: Text(campaign.name),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setDialogState(() {
                          selectedCampaignId = value;
                        });
                      },
                    ),
                  ),
                // Date de validation
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    onTap: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate: selectedDate ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now(),
                        locale: const Locale('fr', 'FR'),
                      );
                      if (date != null) {
                        setDialogState(() {
                          selectedDate = date;
                        });
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        border: Border.all(color: Theme.of(context).dividerColor),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.calendar_today,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Date de validation',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  selectedDate != null
                                      ? _formatDate(selectedDate!)
                                      : 'Sélectionner une date',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Theme.of(context).colorScheme.onSurface,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.arrow_drop_down,
                            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // Nombre de jours de présence
                TextField(
                  controller: presenceDaysController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Nombre de jours de présence',
                    hintText: '0',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Annuler',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                if (selectedCampaignId?.isEmpty ?? true) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Veuillez sélectionner une campagne'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                  return;
                }
                if (selectedDate == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Veuillez sélectionner une date de validation'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                  return;
                }
                final presenceDaysText = presenceDaysController.text.trim();
                if (presenceDaysText.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Veuillez saisir le nombre de jours de présence'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                  return;
                }
                final presenceDays = int.tryParse(presenceDaysText);
                if (presenceDays == null || presenceDays < 0) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Le nombre de jours doit être un nombre positif'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                  return;
                }

                // Sauvegarder les valeurs
                _selectedCampaignIds[prestataire.id] = selectedCampaignId;
                _validationDates[prestataire.id] = selectedDate;
                _presenceDaysControllers[prestataire.id]?.text = presenceDaysText;

                Navigator.pop(context);
                await _validatePrestataire(prestataire);
              },
              child: Text(isValidated ? 'Modifier' : 'Valider'),
            ),
          ],
        ),
      ),
    );
  }
}
