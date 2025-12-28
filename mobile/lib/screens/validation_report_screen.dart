import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../models/prestataire.dart';
import '../models/campaign.dart';
import '../models/user.dart';

class ApprovalReportScreen extends StatefulWidget {
  const ApprovalReportScreen({super.key});

  @override
  State<ApprovalReportScreen> createState() => _ApprovalReportScreenState();
}

class _ApprovalReportScreenState extends State<ApprovalReportScreen> {
  List<Prestataire> _prestataires = [];
  bool _isLoading = true;
  final ApiService _apiService = ApiService();
  late final AuthService _authService;
  String _selectedStatus = 'Tous';
  String? _formId;

  @override
  void initState() {
    super.initState();
    _authService = AuthService(_apiService);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
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

      // Récupérer le zoneId de l'utilisateur connecté
      User? currentUser;
      String? userZoneId;
      try {
        currentUser = await _authService.getCurrentUser();
        userZoneId = currentUser?.zoneId;
        print('DEBUG validation_report: Utilisateur connecté - role=${currentUser?.role}, zoneId=$userZoneId, provinceId=${currentUser?.provinceId}');
      } catch (e) {
        print('DEBUG validation_report: Erreur lors de la récupération de l\'utilisateur: $e');
      }

      // Récupérer les approbations depuis la table du formulaire
      List<Map<String, dynamic>> data;
      if (formId != null) {
        // Passer le zoneId explicitement pour les utilisateurs MCZ (même si le backend devrait le faire automatiquement)
        print('DEBUG validation_report: Appel getApprovalsByForm avec formId=$formId, zoneId=$userZoneId');
        data = await _apiService.getApprovalsByForm(formId, zoneId: userZoneId);
        print('DEBUG validation_report: ${data.length} prestataires reçus du backend');
      } else {
        // Fallback: utiliser getPrestataires
        print('DEBUG validation_report: Pas de formId, utilisation de getPrestataires');
        data = await _apiService.getPrestataires();
      }

      setState(() {
        _prestataires = data.map((json) => Prestataire.fromJson(json)).toList();
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

  List<Prestataire> get _filteredPrestataires {
    if (_selectedStatus == 'Tous') {
      return _prestataires;
    }
    return _prestataires.where((p) {
      final approvalStatus = _getApprovalStatus(p.status);
      return approvalStatus == _selectedStatus;
    }).toList();
  }

  List<String> get _approvalStatuses => [
    'Tous',
    'Approuvé',
    'Non approuvé',
    'En attente',
    'Sans statut',
  ];

  String _getApprovalStatus(String status) {
    switch (status.toUpperCase()) {
      case 'APPROUVE_PAR_MCZ':
        return 'Approuvé';
      case 'REJETE_PAR_MCZ':
        return 'Non approuvé';
      case 'EN_ATTENTE_PAR_MCZ':
        return 'En attente';
      case 'VALIDE_PAR_IT':
      case 'ENREGISTRE':
      default:
        return 'Sans statut';
    }
  }

  DateTime? _getApprovalDate(Prestataire prestataire) {
    // La date d'approbation peut être dans enregistrementData ou updatedAt si le statut est d'approbation MCZ
    if (prestataire.enregistrementData != null) {
      final approvalDate = prestataire.enregistrementData!['approvalDate'];
      if (approvalDate != null) {
        try {
          return DateTime.parse(approvalDate as String);
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }
    }
    // Si le prestataire a un statut d'approbation MCZ, utiliser updatedAt comme date d'approbation
    final status = prestataire.status.toUpperCase();
    if (status == 'APPROUVE_PAR_MCZ' || 
        status == 'REJETE_PAR_MCZ' || 
        status == 'EN_ATTENTE_PAR_MCZ') {
      return prestataire.updatedAt;
    }
    return null;
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'N/A';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Rapport d\'approbation',
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
      body: Column(
        children: [
          // Filtre par statut
          Padding(
            padding: const EdgeInsets.all(16),
            child: DropdownButtonFormField<String>(
              value: _selectedStatus,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Filtrer par statut',
                labelStyle: const TextStyle(color: Colors.white70),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              dropdownColor: const Color(0xFF2C2C2C),
              items: _approvalStatuses.map((status) {
                return DropdownMenuItem(
                  value: status,
                  child: Text(status),
                );
              }).toList(),
              onChanged: (value) {
                setState(() {
                  _selectedStatus = value ?? 'Tous';
                });
              },
            ),
          ),
          // En-tête du tableau
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 2,
                  child: Text(
                    'ID',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'Prénom+Nom',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    'Date approb',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                SizedBox(
                  width: 60,
                  child: Text(
                    'Statut',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
          // Liste des prestataires
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredPrestataires.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.assignment_outlined,
                              size: 64,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Aucun prestataire trouvé',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    color: Colors.grey.shade600,
                                  ),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadData,
                        child: ListView.builder(
                          padding: EdgeInsets.zero,
                          itemCount: _filteredPrestataires.length,
                          itemBuilder: (context, index) {
                            final prestataire = _filteredPrestataires[index];
                            final approvalStatus = _getApprovalStatus(prestataire.status);
                            final approvalColor = _getApprovalStatusColor(approvalStatus);
                            final approvalDate = _getApprovalDate(prestataire);
                            
                            return Container(
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                border: Border(
                                  bottom: BorderSide(
                                    color: Theme.of(context).dividerColor,
                                    width: 0.5,
                                  ),
                                ),
                              ),
                              child: InkWell(
                                onTap: () {
                                  // Optionnel: afficher les détails
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 12,
                                  ),
                                  child: Row(
                                    children: [
                                      // ID
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          prestataire.id,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Theme.of(context).colorScheme.onSurface,
                                            fontFamily: 'monospace',
                                          ),
                                        ),
                                      ),
                                      // Prénom+Nom
                                      Expanded(
                                        flex: 3,
                                        child: Text(
                                          '${prestataire.prenom} ${prestataire.nom}',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w500,
                                            color: Theme.of(context).colorScheme.onSurface,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ),
                                      // Date d'approbation
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          _formatDate(approvalDate),
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                          ),
                                          textAlign: TextAlign.center,
                                        ),
                                      ),
                                      // Statut d'approbation (seulement le carré coloré)
                                      SizedBox(
                                        width: 60,
                                        child: Center(
                                          child: Container(
                                            width: 18,
                                            height: 18,
                                            decoration: BoxDecoration(
                                              color: approvalColor,
                                              shape: BoxShape.rectangle,
                                              borderRadius: BorderRadius.circular(3),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Color _getApprovalStatusColor(String approvalStatus) {
    switch (approvalStatus) {
      case 'Approuvé':
        return Colors.blue;
      case 'Non approuvé':
        return Colors.red;
      case 'En attente':
        return Colors.amber;
      case 'Sans statut':
      default:
        return Colors.grey;
    }
  }
}

