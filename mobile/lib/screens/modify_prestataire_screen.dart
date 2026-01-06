import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../models/prestataire.dart';
import '../models/campaign.dart';
import '../models/user.dart';
import 'edit_prestataire_screen.dart';

class ModifyPrestataireScreen extends StatefulWidget {
  const ModifyPrestataireScreen({super.key});

  @override
  State<ModifyPrestataireScreen> createState() => _ModifyPrestataireScreenState();
}

class _ModifyPrestataireScreenState extends State<ModifyPrestataireScreen> {
  List<Prestataire> _prestataires = [];
  bool _isLoading = true;
  final ApiService _apiService = ApiService();
  String _searchQuery = '';
  String? _formId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Recharger les données quand on revient sur cet écran après une modification
    final result = ModalRoute.of(context)?.settings.arguments;
    if (result == true) {
      _loadData();
    }
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
      // Ne récupérer que les prestataires uniques enregistrés (pas les doublons de validation)
      List<Map<String, dynamic>> data;
      if (formId != null) {
        // includeValidations=false par défaut pour ne récupérer que les prestataires uniques (validationSequence=null)
        print('DEBUG MODIFY: Appel getPrestatairesByForm avec formId=$formId, limit=1000, includeValidations=false');
        final result = await _apiService.getPrestatairesByForm(formId, limit: 1000, includeValidations: false);
        data = List<Map<String, dynamic>>.from(result['data'] ?? []);
        print('DEBUG MODIFY: formId=$formId, result keys=${result.keys.toList()}, data count=${data.length}');
      } else {
        data = await _apiService.getPrestataires();
        print('DEBUG MODIFY: Pas de formId, data count=${data.length}');
      }

      print('DEBUG MODIFY: data count=${data.length}');
      if (data.isNotEmpty) {
        print('DEBUG MODIFY: first item keys=${data.first.keys.toList()}');
      } else {
        print('DEBUG MODIFY: ATTENTION - Aucune donnée retournée par l\'API');
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
        print('DEBUG MODIFY: Utilisateur connecté - role=${currentUser?.role}, aireId=$userAireId, userId=$userId');
      } catch (e) {
        print('DEBUG MODIFY: Erreur lors de la récupération de l\'utilisateur: $e');
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
            
            // Pour les utilisateurs IT, filtrer par aireId
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
                print('DEBUG MODIFY: Prestataire ${prestataire.id} ignoré - aireId=$prestataireAireId (attendu: $userAireId), enregistrePar=$enregistrePar (attendu: $userId)');
                continue;
              }
              
              print('DEBUG MODIFY: Prestataire ${prestataire.id} inclus - aireId=$prestataireAireId, enregistrePar=$enregistrePar');
            }
            
            parsedPrestataires.add(prestataire);
          } else {
            print('DEBUG MODIFY: Prestataire ignoré - id=${prestataire.id}, nom=${prestataire.nom}, prenom=${prestataire.prenom}');
          }
        } catch (e) {
          print('DEBUG MODIFY: Erreur lors du parsing d\'un prestataire: $e');
          print('DEBUG MODIFY: JSON problématique: $json');
        }
      }

      print('DEBUG MODIFY: ${parsedPrestataires.length} prestataires parsés avec succès sur ${data.length}');

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
      final phone = p.telephone?.toLowerCase() ?? '';
      final query = _searchQuery.toLowerCase();
      return name.contains(query) || phone.contains(query);
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
          'Modifier un prestataire',
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
                hintText: 'Rechercher un prestataire à modifier...',
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
                              Icons.edit_outlined,
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
                            const SizedBox(height: 8),
                            Text(
                              'Sélectionnez un prestataire pour le modifier',
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
                          padding: const EdgeInsets.all(8),
                          itemCount: _filteredPrestataires.length,
                          itemBuilder: (context, index) {
                            final prestataire = _filteredPrestataires[index];
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: Colors.blue.shade100,
                                  child: Icon(
                                    Icons.person,
                                    color: Colors.blue.shade700,
                                  ),
                                ),
                                title: Text(
                                  _getFullName(prestataire),
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'ID: ${prestataire.id}',
                                      style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 12,
                                        fontFamily: 'monospace',
                                      ),
                                    ),
                                    if (prestataire.telephone != null) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Téléphone: ${prestataire.telephone}',
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                    if (prestataire.categorie != null) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Rôle: ${prestataire.categorie}',
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                trailing: Icon(
                                  Icons.edit,
                                  color: Colors.blue.shade700,
                                ),
                                onTap: () async {
                                  // Naviguer vers l'écran de modification
                                  final result = await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => EditPrestataireScreen(prestataire: prestataire),
                                    ),
                                  );
                                  // Recharger les données si une modification a été effectuée
                                  if (result == true) {
                                    _loadData();
                                  }
                                },
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
}

