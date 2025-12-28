import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../models/prestataire.dart';
import '../models/campaign.dart';
import '../models/user.dart';

class KYCScreen extends StatefulWidget {
  const KYCScreen({super.key});

  @override
  State<KYCScreen> createState() => _KYCScreenState();
}

class _KYCScreenState extends State<KYCScreen> {
  List<Prestataire> _prestataires = [];
  bool _isLoading = true;
  final ApiService _apiService = ApiService();
  late final AuthService _authService;
  String _searchQuery = '';
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
            // Aucune campagne active trouvée, prendre la première disponible
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
        print('DEBUG KYC: Utilisateur connecté - role=${currentUser?.role}, zoneId=$userZoneId, provinceId=${currentUser?.provinceId}');
      } catch (e) {
        print('DEBUG KYC: Erreur lors de la récupération de l\'utilisateur: $e');
      }

      // Récupérer les prestataires depuis la table du formulaire
      List<Map<String, dynamic>> data;
      if (formId != null) {
        // Utiliser le nouvel endpoint avec formId pour récupérer tous les prestataires
        // Le backend filtre automatiquement par zoneId pour les utilisateurs MCZ
        print('DEBUG KYC: Appel getPrestatairesByForm avec formId=$formId, limit=1000');
        final result = await _apiService.getPrestatairesByForm(formId, limit: 1000);
        data = List<Map<String, dynamic>>.from(result['data'] ?? []);
        print('DEBUG KYC: formId=$formId, result keys=${result.keys.toList()}, data count=${data.length}');
        if (data.isEmpty && userZoneId != null) {
          print('DEBUG KYC: ⚠️ ATTENTION - Aucune donnée retournée pour zoneId=$userZoneId');
        }
      } else {
        // Fallback: utiliser l'ancien endpoint sans formId (le backend trouvera automatiquement)
        print('DEBUG KYC: Pas de formId, utilisation de getPrestatairesPendingValidation');
        data = await _apiService.getPrestatairesPendingValidation();
        print('DEBUG KYC: Pas de formId, data count=${data.length}');
      }
      
      print('DEBUG KYC: formId=$formId, data count=${data.length}');
      if (data.isNotEmpty) {
        print('DEBUG KYC: first item keys=${data.first.keys.toList()}');
        print('DEBUG KYC: first item sample=${data.first.toString().substring(0, data.first.toString().length > 500 ? 500 : data.first.toString().length)}');
      } else {
        print('DEBUG KYC: ATTENTION - Aucune donnée retournée par l\'API');
      }

      // Parser les données et filtrer les objets invalides
      final parsedPrestataires = <Prestataire>[];
      for (final json in data) {
        try {
          final prestataire = Prestataire.fromJson(json);
          // Vérifier que les champs essentiels ne sont pas vides
          if (prestataire.id.isNotEmpty && 
              prestataire.nom.isNotEmpty && 
              prestataire.prenom.isNotEmpty) {
            parsedPrestataires.add(prestataire);
          } else {
            print('DEBUG KYC: Prestataire ignoré - id=${prestataire.id}, nom=${prestataire.nom}, prenom=${prestataire.prenom}');
          }
        } catch (e) {
          print('DEBUG KYC: Erreur lors du parsing d\'un prestataire: $e');
          print('DEBUG KYC: JSON problématique: $json');
        }
      }

      print('DEBUG KYC: ${parsedPrestataires.length} prestataires parsés avec succès sur ${data.length}');

      setState(() {
        _prestataires = parsedPrestataires;
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
    if (_searchQuery.isEmpty) {
      return _prestataires;
    }
    return _prestataires.where((p) {
      final name = '${p.prenom} ${p.nom} ${p.postnom ?? ""}'.toLowerCase();
      final id = p.id.toLowerCase();
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || id.contains(query);
    }).toList();
  }

  String _getFullName(Prestataire p) {
    return '${p.prenom} ${p.nom}${p.postnom != null ? " ${p.postnom}" : ""}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Statut KYC',
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
          // Barre de recherche
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Rechercher un prestataire...',
                hintStyle: TextStyle(color: Colors.white60),
                prefixIcon: const Icon(Icons.search, color: Colors.white70),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
              ),
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
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
                    'Nom prestataire',
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
                    'Numéro phone',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                SizedBox(
                  width: 50,
                  child: Column(
                    children: [
                      Text(
                        'K',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        'Y',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        'C',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ],
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
                              Icons.verified_user_outlined,
                              size: 64,
                              color: Colors.grey.shade400,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _searchQuery.isEmpty
                                  ? 'Aucun prestataire trouvé'
                                  : 'Aucun résultat pour "$_searchQuery"',
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
                            final kycColor = _getKYCStatusColor(prestataire.kycStatus);
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
                                  _showKYCDetails(context, prestataire);
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
                                      // Nom prestataire
                                      Expanded(
                                        flex: 3,
                                        child: Text(
                                          _getFullName(prestataire),
                                          style: TextStyle(
                                            fontWeight: FontWeight.w500,
                                            color: Theme.of(context).colorScheme.onSurface,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ),
                                      // Numéro téléphone
                                      Expanded(
                                        flex: 2,
                                        child: Text(
                                          prestataire.telephone ?? 'N/A',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                          ),
                                          textAlign: TextAlign.center,
                                        ),
                                      ),
                                      // Indicateur KYC
                                      SizedBox(
                                        width: 50,
                                        child: Center(
                                          child: Container(
                                            width: 20,
                                            height: 20,
                                            decoration: BoxDecoration(
                                              color: kycColor,
                                              shape: BoxShape.circle,
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

  /// Retourne la couleur selon le statut KYC
  /// CORRECT (Bleu), INCORRECT (Jaune), SANS_COMPTE (Rouge), null (Gris - non vérifié)
  Color _getKYCStatusColor(String? kycStatus) {
    if (kycStatus == null) {
      return Colors.grey; // Non vérifié
    }
    switch (kycStatus.toUpperCase()) {
      case 'CORRECT':
        return Colors.blue;
      case 'INCORRECT':
        return Colors.amber;
      case 'SANS_COMPTE':
        return Colors.red;
      default:
        return Colors.grey; // Non vérifié ou statut inconnu
    }
  }

  IconData _getKYCStatusIcon(String? kycStatus) {
    if (kycStatus == null) {
      return Icons.help_outline; // Non vérifié
    }
    switch (kycStatus.toUpperCase()) {
      case 'CORRECT':
        return Icons.check_circle;
      case 'INCORRECT':
        return Icons.warning;
      case 'SANS_COMPTE':
        return Icons.cancel;
      default:
        return Icons.help_outline;
    }
  }

  String _getKYCStatusLabel(String? kycStatus) {
    if (kycStatus == null) {
      return 'Non vérifié';
    }
    switch (kycStatus.toUpperCase()) {
      case 'CORRECT':
        return 'Correct';
      case 'INCORRECT':
        return 'Incorrect';
      case 'SANS_COMPTE':
        return 'Sans compte';
      default:
        return 'Non vérifié';
    }
  }

  void _showKYCDetails(BuildContext context, Prestataire prestataire) {
    final kycColor = _getKYCStatusColor(prestataire.kycStatus);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(
          _getFullName(prestataire),
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('ID', prestataire.id),
              const SizedBox(height: 8),
              _buildDetailRow('Prénom', prestataire.prenom),
              const SizedBox(height: 8),
              _buildDetailRow('Nom', prestataire.nom),
              if (prestataire.postnom != null) ...[
                const SizedBox(height: 8),
                _buildDetailRow('Postnom', prestataire.postnom!),
              ],
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: kycColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: kycColor),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        color: kycColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Statut KYC',
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _getKYCStatusLabel(prestataire.kycStatus),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: kycColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Fermer',
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
            ),
          ),
        ],
      ),
    );
  }
}

